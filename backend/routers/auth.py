"""Authentication Router"""
from typing import Optional
from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, EmailStr, Field, field_validator
from services.supabase_client import (
    sign_up, sign_in, sign_out, verify_token, refresh_session, reset_password
)
from services.errors import AuthError, ValidationError, handle_errors
import re

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: Optional[str] = Field(None, max_length=100)

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one number')
        return v

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return v.strip()
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class ResetPasswordRequest(BaseModel):
    email: EmailStr


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    avatar_url: Optional[str] = None


class SessionResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: Optional[int] = None


class AuthResponse(BaseModel):
    user: UserResponse
    session: Optional[SessionResponse] = None


async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> Optional[dict]:
    """Returns user data from token, or None if not authenticated"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    token = authorization[7:]
    if not token:
        return None
    
    user_data = await verify_token(token)
    return user_data


async def require_auth(user: Optional[dict] = Depends(get_current_user)) -> dict:
    if not user:
        raise AuthError("Authentication required")
    return user


@router.post("/signup", response_model=AuthResponse)
@handle_errors
async def signup_route(request: SignupRequest):
    try:
        result = await sign_up(
            email=request.email, 
            password=request.password, 
            name=request.name
        )
        return AuthResponse(
            user=UserResponse(**result["user"]),
            session=SessionResponse(**result["session"]) if result.get("session") else None,
        )
    except ValueError as e:
        raise ValidationError(str(e))


@router.post("/login", response_model=AuthResponse)
@handle_errors
async def login_route(request: LoginRequest):
    try:
        result = await sign_in(email=request.email, password=request.password)
        return AuthResponse(
            user=UserResponse(**result["user"]), 
            session=SessionResponse(**result["session"])
        )
    except ValueError:
        raise AuthError("Invalid email or password")


@router.post("/logout")
@handle_errors
async def logout_route(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        await sign_out(authorization[7:])
    return {"success": True}


@router.post("/refresh", response_model=AuthResponse)
@handle_errors
async def refresh_route(request: RefreshRequest):
    try:
        result = await refresh_session(request.refresh_token)
        return AuthResponse(
            user=UserResponse(**result["user"]), 
            session=SessionResponse(**result["session"])
        )
    except ValueError:
        raise AuthError("Session expired. Please sign in again.")


@router.post("/reset-password")
@handle_errors
async def reset_password_route(request: ResetPasswordRequest):
    await reset_password(request.email)
    return {"success": True, "message": "If an account exists, a reset link will be sent."}


@router.get("/me", response_model=UserResponse)
@handle_errors
async def get_me(user: dict = Depends(require_auth)):
    return UserResponse(
        id=user["id"], 
        email=user["email"], 
        name=user.get("name"), 
        avatar_url=user.get("avatar_url")
    )
