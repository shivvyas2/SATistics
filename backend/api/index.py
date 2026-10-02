"""
Vercel Serverless Function Entry Point
Vercel's Python runtime serves the ASGI app directly
"""
import os
import sys

# Add backend directory to Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from src.main import app  # noqa: E402,F401
