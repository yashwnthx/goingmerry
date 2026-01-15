"""Application Configuration"""
import os
from dataclasses import dataclass
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()


@dataclass
class SupabaseConfig:
    url: str
    anon_key: str
    service_role_key: str
    db_url: str
    
    @classmethod
    def from_env(cls) -> "SupabaseConfig":
        return cls(
            url=os.environ.get("SUPABASE_URL", ""),
            anon_key=os.environ.get("SUPABASE_ANON_KEY", ""),
            service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
            db_url=os.environ.get("DATABASE_URL", ""),
        )


@dataclass
class AIConfig:
    api_key: str
    model: str = "llama-3.3-70b-versatile"
    
    @classmethod
    def from_env(cls) -> "AIConfig":
        return cls(
            api_key=os.environ.get("GROQ_API_KEY", ""),
            model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
        )


@dataclass
class SearchConfig:
    api_key: str
    
    @classmethod
    def from_env(cls) -> "SearchConfig":
        return cls(api_key=os.environ.get("BRAVE_SEARCH_API_KEY", ""))


@dataclass
class AppConfig:
    supabase: SupabaseConfig
    ai: AIConfig
    search: SearchConfig
    environment: str
    debug: bool
    
    @classmethod
    def from_env(cls) -> "AppConfig":
        return cls(
            supabase=SupabaseConfig.from_env(),
            ai=AIConfig.from_env(),
            search=SearchConfig.from_env(),
            environment=os.environ.get("ENVIRONMENT", "development"),
            debug=os.environ.get("DEBUG", "false").lower() == "true",
        )


@lru_cache
def get_config() -> AppConfig:
    return AppConfig.from_env()


def validate_config() -> list[str]:
    errors = []
    config = get_config()
    
    if not config.supabase.url:
        errors.append("SUPABASE_URL is required")
    if not config.supabase.anon_key:
        errors.append("SUPABASE_ANON_KEY is required")
    if not config.supabase.db_url:
        errors.append("DATABASE_URL is required")
    
    return errors
