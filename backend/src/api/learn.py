"""
Learning endpoints: lesson videos for course topics
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from src.api.auth import get_current_user
from src.models.schemas import VideoResponse
from src.services.videos import find_topic_videos

router = APIRouter()

@router.get("/videos", response_model=VideoResponse)
async def get_topic_videos(
    exam: str = Query(..., pattern="^(sat|gre)$"),
    section: str = Query(..., pattern="^(quant|verbal)$"),
    topic: str = Query(..., min_length=2, max_length=80),
    limit: int = Query(6, ge=1, le=12),
    current_user: dict = Depends(get_current_user),
):
    """YouTube lessons for one topic, best matches first"""
    try:
        videos = await find_topic_videos(exam, section, topic, limit)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Video search failed: {e}")
    return VideoResponse(videos=videos)
