"""
FastAPI Backend for NYU Hacks Arcade
Handles authentication, game scores, user statistics, and question bank
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

# Load environment variables from backend/.env
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="NYU Hacks Arcade API",
    description="Backend API for NYU Hacks Arcade - Authentication, Scores, Statistics, and Question Bank",
    version="1.0.0"
)

# CORS middleware - MUST be added before routers
# This handles OPTIONS preflight requests automatically
# Get allowed origins from environment or use defaults
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else []
# Add default localhost origins for development
default_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
# Combine and filter out empty strings
allowed_origins = [origin for origin in allowed_origins + default_origins if origin]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Import routers
try:
    from src.api import auth, games, stats, questions, health, profile, learn, materials
except ImportError:
    # If running as script, use relative imports
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from src.api import auth, games, stats, questions, health, profile, learn, materials

# Include routers
app.include_router(health.router, prefix="/api/health", tags=["Health"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(games.router, prefix="/api/games", tags=["Games"])
app.include_router(stats.router, prefix="/api/stats", tags=["Statistics"])
app.include_router(questions.router, prefix="/api/questions", tags=["Questions"])
app.include_router(profile.router, prefix="/api/profile", tags=["Profile"])
app.include_router(learn.router, prefix="/api/learn", tags=["Learn"])
app.include_router(materials.router, prefix="/api/materials", tags=["Materials"])

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "NYU Hacks Arcade API",
        "version": "1.0.0",
        "status": "running"
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    import traceback
    print(f"Unhandled exception: {exc}")
    print(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

if __name__ == "__main__":
    import uvicorn
    import os
    import sys
    
    # Get the directory containing this file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    
    # Add parent directory to path if not already there
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
