"""
Authentication endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from src.models.schemas import RefreshRequest, SessionTokens, UserSignup, UserLogin, TokenResponse
from src.services.auth_service import AuthService
from src.utils.database import get_db
from supabase import Client

router = APIRouter()
security = HTTPBearer(auto_error=False)  # Don't auto-raise on missing token

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Client = Depends(get_db)
) -> dict:
    """Get current authenticated user"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token")
    
    token = credentials.credentials
    auth_service = AuthService(db)
    user = await auth_service.get_user(token)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return user

@router.options("/signup")
async def signup_options(request: Request):
    """Handle OPTIONS preflight for signup - no dependencies needed"""
    # CORS middleware should handle this, but explicit handler ensures it works
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type, authorization",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
        }
    )

@router.post("/signup")
async def signup(user_data: UserSignup, db: Client = Depends(get_db)):
    """Sign up a new user using Supabase Auth"""
    try:
        auth_service = AuthService(db)
        result = await auth_service.signup(user_data)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result.get("error", "Signup failed"))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        # Log the error for debugging
        import traceback
        print(f"Signup error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.options("/login")
async def login_options(request: Request):
    """Handle OPTIONS preflight for login - no dependencies needed"""
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type, authorization",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
        }
    )

@router.post("/login")
async def login(user_data: UserLogin, db: Client = Depends(get_db)):
    """Login user"""
    auth_service = AuthService(db)
    result = await auth_service.login(user_data)
    
    if not result["success"]:
        raise HTTPException(status_code=401, detail=result.get("error", "Invalid credentials"))
    
    return TokenResponse(
        access_token=result["access_token"],
        refresh_token=result["refresh_token"],
        expires_at=result["expires_at"],
        user=result["user"]
    )

@router.post("/refresh", response_model=SessionTokens)
async def refresh(request: RefreshRequest, db: Client = Depends(get_db)):
    """Swaps a refresh token for a new session. 401 means the session is over and the user must sign in again"""
    tokens = await AuthService(db).refresh(request.refresh_token)
    if not tokens:
        raise HTTPException(status_code=401, detail="Your session has ended. Sign in again.")
    return SessionTokens(**tokens)

@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Client = Depends(get_db)
):
    """Logout user"""
    token = credentials.credentials if credentials else None
    auth_service = AuthService(db)
    result = await auth_service.logout(token or "")
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Logout failed"))
    
    return result

@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return current_user

