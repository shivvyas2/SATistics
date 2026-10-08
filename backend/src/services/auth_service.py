"""
Authentication service - handles Supabase authentication
"""

import time
from supabase import Client
from src.utils.database import Database
from src.models.schemas import TERMS_VERSION, UserSignup, UserLogin
from typing import Optional, Dict, Tuple
from datetime import datetime, timezone

# Verified tokens, so most requests don't need a round trip to Supabase: token -> (trust until, user)
_verified_tokens: Dict[str, Tuple[float, Dict]] = {}
VERIFIED_TOKEN_TTL = 300
_verifier: Optional[Client] = None


def _token_verifier() -> Client:
    """A client that only checks tokens. It never signs in, so its own credentials never change"""
    global _verifier
    if _verifier is None:
        _verifier = Database.new_auth_client()
    return _verifier


def session_tokens(session) -> Dict:
    """What the browser needs to keep a session going"""
    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "expires_at": session.expires_at,
    }


class AuthService:
    def __init__(self, db: Client):
        self.db = db
    
    async def signup(self, user_data: UserSignup) -> Dict:
        """Sign up a new user using Supabase Auth"""
        try:
            # Use Supabase auth.sign_up() which handles user creation
            # If email confirmation is disabled in Supabase, this will return a session
            response = Database.new_auth_client().auth.sign_up({
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
                    result.update(session_tokens(response.session))
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
            response = Database.new_auth_client().auth.sign_in_with_password({
                "email": user_data.email,
                "password": user_data.password,
            })
            
            if response.user and response.session:
                return {
                    "success": True,
                    **session_tokens(response.session),
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
        """The user a token belongs to, or None if Supabase doesn't accept it (forged, expired or revoked)"""
        now = time.time()
        cached = _verified_tokens.get(token)
        if cached and cached[0] > now:
            return cached[1]
        try:
            response = _token_verifier().auth.get_user(token)
        except Exception as e:
            print(f"Token rejected: {type(e).__name__}")
            return None
        if not response or not response.user:
            return None
        user = {"id": response.user.id, "email": response.user.email or ""}

        # Trust it for a few minutes, never past its expiry. The expiry is read from the token
        # only after Supabase has accepted it
        import jwt
        expires = jwt.decode(token, options={"verify_signature": False}).get("exp", now)
        if len(_verified_tokens) > 5000:
            _verified_tokens.clear()
        _verified_tokens[token] = (min(now + VERIFIED_TOKEN_TTL, expires), user)
        return user

    async def refresh(self, refresh_token: str) -> Optional[Dict]:
        """A new session from a refresh token, or None when the session has ended"""
        try:
            response = Database.new_auth_client().auth.refresh_session(refresh_token)
        except Exception as e:
            print(f"Session refresh failed: {type(e).__name__}")
            return None
        return session_tokens(response.session) if response and response.session else None

    async def logout(self, token: str) -> Dict:
        """Ends this session in Supabase, so its refresh token stops working"""
        _verified_tokens.pop(token, None)
        if token:
            try:
                Database.new_auth_client().auth.admin.sign_out(token, "local")
            except Exception as e:
                # The browser drops its tokens either way
                print(f"Could not end the session in Supabase: {type(e).__name__}")
        return {"success": True, "message": "Logged out successfully"}
