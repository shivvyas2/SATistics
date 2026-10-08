"""
User profile endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from src.models.schemas import Profile, ProfileResponse
from src.utils.database import get_db
from src.api.auth import get_current_user
from supabase import Client
from datetime import datetime, timezone

router = APIRouter()

PROFILE_FIELDS = "display_name,username,exam,target_score,test_date,daily_minutes,avatar_color"

@router.get("", response_model=ProfileResponse)
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Get the current user's profile, or null if they haven't created one"""
    try:
        result = db.table("profiles").select(PROFILE_FIELDS).eq("user_id", current_user["id"]).execute()
        return ProfileResponse(profile=Profile(**result.data[0]) if result.data else None)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("", response_model=ProfileResponse)
async def save_profile(
    profile: Profile,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """Create or update the current user's profile"""
    taken = (
        db.table("profiles")
        .select("user_id")
        .eq("username", profile.username)
        .neq("user_id", current_user["id"])
        .execute()
    )
    if taken.data:
        raise HTTPException(status_code=409, detail=f"The username @{profile.username} is taken. Try another one.")

    row = profile.model_dump(mode="json")
    row["user_id"] = current_user["id"]
    row["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = db.table("profiles").upsert(row, on_conflict="user_id").execute()
        return ProfileResponse(profile=Profile(**result.data[0]))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Tables holding a user's data, exported as they are stored. Deleting the account removes
# all of them: each references auth.users with ON DELETE CASCADE.
EXPORT_TABLES = ("profiles", "user_stats", "game_sessions", "question_attempts", "materials", "custom_questions")


@router.get("/export")
async def export_data(current_user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    """Everything stored about the current user, as JSON"""
    data = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "account": {"id": current_user["id"], "email": current_user.get("email")},
    }
    for table in EXPORT_TABLES:
        try:
            data[table] = db.table(table).select("*").eq("user_id", current_user["id"]).execute().data
        except Exception as e:
            data[table] = {"error": f"Could not read this table: {e}"}
    return data


@router.delete("")
async def delete_account(current_user: dict = Depends(get_current_user), db: Client = Depends(get_db)):
    """Deletes the account and, through the cascades, everything stored about the user"""
    try:
        db.auth.admin.delete_user(current_user["id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not delete the account: {e}")
    return {"success": True}
