"""
Study material endpoints
Upload notes or practice tests, review the questions found in them, and
approve the ones that should appear in games
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from supabase import Client
from typing import List, Literal, Optional

from src.api.auth import get_current_user
from src.services.material_parser import extract_text, merge_questions, parse_questions, questions_from_llm
from src.utils.database import get_db

router = APIRouter()

# Vercel rejects request bodies over 4.5 MB, so stay under that
MAX_UPLOAD_BYTES = 4 * 1024 * 1024
MIN_TEXT_CHARS = 40
DEFAULT_TOPIC = "My material"


class QuestionUpdate(BaseModel):
    question: Optional[str] = None
    options: Optional[List[str]] = None
    correct_answer: Optional[int] = None
    explanation: Optional[str] = None
    status: Optional[Literal["pending", "approved"]] = None


def _own_material(db: Client, user_id: str, material_id: str) -> dict:
    result = db.table("materials").select("*").eq("id", material_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Material not found")
    return result.data[0]


@router.post("")
async def upload_material(
    exam: Literal["sat", "gre"] = Form(...),
    section: Literal["quant", "verbal"] = Form(...),
    name: str = Form(""),
    text: str = Form(""),
    generate: bool = Form(False),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_db),
):
    """
    Upload a PDF or text file (or pasted text) and pull practice questions out of it.
    Questions start as pending; they appear in games once approved.
    With generate=true the AI also writes new questions from the material.
    """
    if file is not None:
        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="That file is too large. The limit is 4 MB.")
        try:
            text = extract_text(file.filename or "", content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read that file: {e}")
        name = name or (file.filename or "")
    if len(text.strip()) < MIN_TEXT_CHARS:
        raise HTTPException(
            status_code=400,
            detail="No readable text found. Scanned PDFs need to be converted to text first.",
        )

    parsed = parse_questions(text)
    # The LLM covers material the parser can't read, and writes new questions when asked
    from_llm = await questions_from_llm(text, exam, section, generate) if generate or not parsed else []
    questions = merge_questions(parsed, from_llm)
    if not questions:
        raise HTTPException(
            status_code=422,
            detail='No questions found. Number the questions ("1.") and letter the choices ("A)"), '
            "or turn on question writing to make questions from notes.",
        )

    user_id = current_user["id"]
    material = (
        db.table("materials")
        .insert({"user_id": user_id, "name": name.strip() or "Untitled material", "exam": exam, "section": section})
        .execute()
        .data[0]
    )
    rows = [
        {
            "material_id": material["id"],
            "user_id": user_id,
            "exam": exam,
            "section": section,
            "question": q["question"],
            "passage": q.get("passage", ""),
            "options": q["options"],
            "correct_answer": q["correctAnswer"],
            "topic": q.get("topic") or DEFAULT_TOPIC,
            "difficulty": q.get("difficulty", "medium"),
            "explanation": q.get("explanation", ""),
            "origin": q["origin"],
        }
        for q in questions
    ]
    saved = db.table("custom_questions").insert(rows).execute().data
    return {"material": material, "questions": saved}


@router.get("")
async def list_materials(current_user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    """The user's materials, newest first, with how many questions each has"""
    user_id = current_user["id"]
    materials = db.table("materials").select("*").eq("user_id", user_id).order("created_at", desc=True).execute().data
    questions = db.table("custom_questions").select("material_id,status").eq("user_id", user_id).execute().data
    for material in materials:
        own = [q for q in questions if q["material_id"] == material["id"]]
        material["question_count"] = len(own)
        material["approved_count"] = sum(1 for q in own if q["status"] == "approved")
    return {"materials": materials}


@router.get("/{material_id}/questions")
async def list_material_questions(
    material_id: str, current_user: dict = Depends(get_current_user), db: Client = Depends(get_db)
):
    _own_material(db, current_user["id"], material_id)
    questions = db.table("custom_questions").select("*").eq("material_id", material_id).order("id").execute().data
    return {"questions": questions}


@router.patch("/questions/{question_id}")
async def update_question(
    question_id: int,
    update: QuestionUpdate,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_db),
):
    """Edit a question or change its status. A question needs an answer before it can be approved."""
    existing = db.table("custom_questions").select("*").eq("id", question_id).eq("user_id", current_user["id"]).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Question not found")
    changes = update.model_dump(exclude_unset=True)
    merged = {**existing.data[0], **changes}
    answer = merged["correct_answer"]
    if answer is not None and not 0 <= answer < len(merged["options"]):
        raise HTTPException(status_code=400, detail="The answer must be one of the choices.")
    if merged["status"] == "approved" and answer is None:
        raise HTTPException(status_code=400, detail="Pick the correct answer before approving this question.")
    result = db.table("custom_questions").update(changes).eq("id", question_id).eq("user_id", current_user["id"]).execute()
    return {"question": result.data[0]}


@router.delete("/questions/{question_id}")
async def delete_question(question_id: int, current_user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    db.table("custom_questions").delete().eq("id", question_id).eq("user_id", current_user["id"]).execute()
    return {"success": True}


@router.post("/{material_id}/approve-all")
async def approve_all(material_id: str, current_user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    """Approve every question in a material that has an answer"""
    _own_material(db, current_user["id"], material_id)
    questions = db.table("custom_questions").select("id,correct_answer").eq("material_id", material_id).execute().data
    ready = [q["id"] for q in questions if q["correct_answer"] is not None]
    if ready:
        db.table("custom_questions").update({"status": "approved"}).in_("id", ready).execute()
    return {"approved": len(ready), "needs_answer": len(questions) - len(ready)}


@router.delete("/{material_id}")
async def delete_material(material_id: str, current_user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    """Delete a material and all of its questions"""
    _own_material(db, current_user["id"], material_id)
    db.table("custom_questions").delete().eq("material_id", material_id).execute()
    db.table("materials").delete().eq("id", material_id).execute()
    return {"success": True}
