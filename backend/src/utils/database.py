"""
Database connection and utilities
"""

from supabase import create_client, Client
import os
from typing import Optional

class Database:
    """Singleton database connection"""
    _instance: Optional[Client] = None
    
    @classmethod
    def get_client(cls) -> Client:
        """Get or create Supabase client for database operations"""
        if cls._instance is None:
            # Load from .env file in backend directory
            env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
            if os.path.exists(env_path):
                from dotenv import load_dotenv
                load_dotenv(env_path)
            
            supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            # For authentication operations, we can use anon key
            # For database operations with RLS, service role key bypasses RLS
            # Prefer service role key if available, otherwise use anon key
            supabase_key = (
                os.getenv("SUPABASE_SERVICE_ROLE_KEY")
                or os.getenv("SUPABASE_SERVICE_KEY")
                or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
            )
            
            if not supabase_url or not supabase_key:
                raise ValueError(
                    "Supabase URL and Key are required. "
                    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in backend/.env"
                )
            
            cls._instance = create_client(supabase_url, supabase_key)
        
        return cls._instance
    
    @classmethod
    def get_auth_client(cls) -> Client:
        """Get Supabase client specifically for authentication operations"""
        # For auth operations, we should use anon key to respect RLS
        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("Supabase URL and Key are required for authentication")
        
        return create_client(supabase_url, supabase_key)

def get_db() -> Client:
    """Dependency for FastAPI routes"""
    return Database.get_client()

