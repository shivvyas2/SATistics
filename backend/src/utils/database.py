"""
Database connection and utilities
"""

from supabase import ClientOptions, create_client, Client
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
    def new_auth_client(cls) -> Client:
        """
        A throwaway client for signing in, signing up and refreshing sessions. Signing in on a
        Supabase client switches its database requests to that user's token, so these must
        never run on the shared client from get_client.
        """
        cls.get_client()  # loads backend/.env
        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = (
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_SERVICE_KEY")
            or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        )
        return create_client(
            supabase_url, supabase_key, options=ClientOptions(auto_refresh_token=False, persist_session=False)
        )

def get_db() -> Client:
    """Dependency for FastAPI routes"""
    return Database.get_client()

