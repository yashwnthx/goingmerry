"""Supabase Auth Service"""
from typing import Optional
from supabase import create_client, Client
from config import get_config


class SupabaseService:
    _client: Optional[Client] = None
    
    @classmethod
    def get_client(cls) -> Client:
        if cls._client is None:
            config = get_config()
            if not config.supabase.url or not config.supabase.anon_key:
                raise ValueError("Supabase configuration missing")
            cls._client = create_client(config.supabase.url, config.supabase.anon_key)
        return cls._client


async def verify_token(token: str) -> Optional[dict]:
    try:
        client = SupabaseService.get_client()
        response = client.auth.get_user(token)
        if response and response.user:
            return {
                "id": str(response.user.id),
                "email": response.user.email,
                "name": response.user.user_metadata.get("name", response.user.email.split("@")[0]),
                "avatar_url": response.user.user_metadata.get("avatar_url"),
            }
        return None
    except Exception:
        return None


async def sign_up(email: str, password: str, name: str = None) -> dict:
    client = SupabaseService.get_client()
    metadata = {"name": name} if name else {}
    
    response = client.auth.sign_up({
        "email": email,
        "password": password,
        "options": {"data": metadata},
    })
    
    if response.user:
        return {
            "user": {
                "id": str(response.user.id),
                "email": response.user.email,
                "name": name or response.user.email.split("@")[0],
            },
            "session": {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "expires_at": response.session.expires_at,
            } if response.session else None,
        }
    raise ValueError("Signup failed")


async def sign_in(email: str, password: str) -> dict:
    client = SupabaseService.get_client()
    response = client.auth.sign_in_with_password({"email": email, "password": password})
    
    if response.user and response.session:
        return {
            "user": {
                "id": str(response.user.id),
                "email": response.user.email,
                "name": response.user.user_metadata.get("name", response.user.email.split("@")[0]),
                "avatar_url": response.user.user_metadata.get("avatar_url"),
            },
            "session": {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "expires_at": response.session.expires_at,
            },
        }
    raise ValueError("Invalid credentials")


async def sign_out(token: str) -> bool:
    try:
        SupabaseService.get_client().auth.sign_out()
        return True
    except Exception:
        return False


async def refresh_session(refresh_token: str) -> dict:
    client = SupabaseService.get_client()
    response = client.auth.refresh_session(refresh_token)
    
    if response.user and response.session:
        return {
            "user": {
                "id": str(response.user.id),
                "email": response.user.email,
                "name": response.user.user_metadata.get("name", response.user.email.split("@")[0]),
            },
            "session": {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "expires_at": response.session.expires_at,
            },
        }
    raise ValueError("Session refresh failed")


async def reset_password(email: str) -> bool:
    try:
        SupabaseService.get_client().auth.reset_password_email(email)
        return True
    except Exception:
        return False
