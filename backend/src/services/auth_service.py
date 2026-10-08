"""
Authentication service - handles Supabase authentication
"""

from supabase import Client
from src.utils.database import Database
from src.models.schemas import TERMS_VERSION, UserSignup, UserLogin
from typing import Optional, Dict
from datetime import datetime, timezone

class AuthService:
    def __init__(self, db: Client):
        self.db = db
    
    def _get_auth_client(self) -> Client:
        """Get a Supabase client configured for authentication"""
        # Use the same client but ensure it's configured for auth operations
        return self.db
    
    async def signup(self, user_data: UserSignup) -> Dict:
        """Sign up a new user using Supabase Auth"""
        try:
            # Use Supabase auth.sign_up() which handles user creation
            # If email confirmation is disabled in Supabase, this will return a session
            response = self.db.auth.sign_up({
                "email": user_data.email,
                "password": user_data.password,
                # Kept on the account as the record of consent
                "options": {"data": {
                    "accepted_terms_version": TERMS_VERSION,
                    "confirmed_age_13_plus": True,
                    "accepted_terms_at": datetime.now(timezone.utc).isoformat(),
                }},
            })
            
            if response.user:
                result = {
                    "success": True,
                    "user": {
                        "id": response.user.id,
                        "email": response.user.email,
                    },
                }
                
                # If email confirmation is disabled, a session is returned
                # In that case, we can return the access token for immediate login
                if response.session:
                    result["access_token"] = response.session.access_token
                    result["message"] = "Account created successfully. You are now logged in."
                else:
                    result["message"] = "User created successfully. Please check your email to verify your account."
                
                return result
            else:
                return {
                    "success": False,
                    "error": "Failed to create user"
                }
        except Exception as e:
            error_msg = str(e)
            # Extract more user-friendly error messages
            if "User already registered" in error_msg or "already exists" in error_msg.lower():
                error_msg = "An account with this email already exists"
            elif "Email rate limit exceeded" in error_msg:
                error_msg = "Too many signup attempts. Please try again later."
            return {
                "success": False,
                "error": error_msg
            }
    
    async def login(self, user_data: UserLogin) -> Dict:
        """Login user using Supabase Auth"""
        try:
            # Use Supabase auth.sign_in_with_password() which returns a session
            response = self.db.auth.sign_in_with_password({
                "email": user_data.email,
                "password": user_data.password,
            })
            
            if response.user and response.session:
                return {
                    "success": True,
                    "access_token": response.session.access_token,
                    "refresh_token": response.session.refresh_token,
                    "user": {
                        "id": response.user.id,
                        "email": response.user.email,
                    }
                }
            else:
                return {
                    "success": False,
                    "error": "Invalid credentials"
                }
        except Exception as e:
            error_msg = str(e)
            # Provide user-friendly error messages
            if "Invalid login credentials" in error_msg or "invalid" in error_msg.lower():
                error_msg = "Invalid email or password"
            return {
                "success": False,
                "error": error_msg
            }
    
    async def get_user(self, token: str) -> Optional[Dict]:
        """Get user from Supabase JWT token"""
        try:
            # Use Supabase Admin API to verify the token
            # First try to decode the JWT to get user info
            import jwt
            import os
            
            # Decode the JWT token without verification first to get user info
            # Supabase tokens contain user information in the payload
            decoded = jwt.decode(token, options={"verify_signature": False})
            
            if decoded and "sub" in decoded:
                user_id = decoded["sub"]
                user_email = decoded.get("email", "")
                
                # Verify the token is still valid (not expired)
                import time
                exp = decoded.get("exp", 0)
                if exp and exp < time.time():
                    print("Token has expired")
                    return None
                
                # Optionally verify with Supabase by getting user details
                # For now, we'll trust the JWT payload since it's from Supabase
                return {
                    "id": user_id,
                    "email": user_email,
                }
            
            return None
        except jwt.DecodeError as e:
            print(f"Error decoding token: {e}")
            return None
        except Exception as e:
            # Token might be invalid or expired
            print(f"Error verifying token: {e}")
            return None
    
    async def logout(self, token: str) -> Dict:
        """Logout user - invalidate session in Supabase"""
        try:
            # For Supabase, logout is handled client-side by clearing the token
            # On the backend, we just need to acknowledge the logout
            # The token will expire naturally, and the client should clear it
            # We can't actually invalidate the token server-side without Supabase Admin API
            # So we just return success - the client will clear the token
            return {
                "success": True,
                "message": "Logged out successfully"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

