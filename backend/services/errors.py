"""Standardized Error Handling"""
from fastapi import HTTPException, status
from functools import wraps
from typing import Callable, Any
import logging

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base application error"""
    def __init__(self, message: str, code: str = "error", status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, resource: str = "Resource"):
        super().__init__(f"{resource} not found", "not_found", 404)


class ValidationError(AppError):
    def __init__(self, message: str):
        super().__init__(message, "validation_error", 400)


class AuthError(AppError):
    def __init__(self, message: str = "Authentication required"):
        super().__init__(message, "auth_error", 401)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Access denied"):
        super().__init__(message, "forbidden", 403)


class ConflictError(AppError):
    def __init__(self, message: str):
        super().__init__(message, "conflict", 409)


class ServiceError(AppError):
    def __init__(self, message: str = "Service unavailable"):
        super().__init__(message, "service_error", 503)


def to_http_exception(error: Exception) -> HTTPException:
    """Convert any error to HTTPException"""
    if isinstance(error, HTTPException):
        return error
    
    if isinstance(error, AppError):
        return HTTPException(status_code=error.status_code, detail=error.message)
    
    # Log unexpected errors
    print(f"[!] Unexpected error: {type(error).__name__}: {error}")
    import traceback
    traceback.print_exc()
    return HTTPException(status_code=500, detail="An unexpected error occurred")


def handle_errors(func: Callable) -> Callable:
    """Decorator for consistent error handling"""
    @wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            raise
        except AppError as e:
            raise to_http_exception(e)
        except Exception as e:
            raise to_http_exception(e)
    return wrapper
