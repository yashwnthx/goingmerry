"""Merry API Server"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import time
import traceback

load_dotenv()

from config import get_config, validate_config
from db.connection import init_db
from ai import get_ai_client
from services.brave_search import get_search_client
from routers import ai, documents, export, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[*] Starting Merry...")
    
    errors = validate_config()
    if errors:
        print(f"[!] Config warnings: {errors}")
    
    try:
        await init_db()
        print("[+] Database initialized")
    except Exception as e:
        print(f"[!] Database init skipped: {e}")
    
    try:
        client = get_ai_client()
        print(f"[+] AI connected: {client.model_name}")
    except Exception as e:
        print(f"[!] AI init failed: {e}")
    
    try:
        get_search_client()
        print("[+] Search connected")
    except Exception as e:
        print(f"[!] Search init failed: {e}")
    
    yield
    print("[*] Shutting down...")


app = FastAPI(
    title="Merry",
    description="AI Document Generation Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://localhost:5173",
        "https://thegoingmerry.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    import sys
    start = time.time()
    print(f"[>] {request.method} {request.url.path}", flush=True)
    sys.stdout.flush()
    try:
        response = await call_next(request)
        duration = round((time.time() - start) * 1000)
        print(f"[<] {request.method} {request.url.path} -> {response.status_code} ({duration}ms)", flush=True)
        sys.stdout.flush()
        return response
    except Exception as e:
        print(f"[!] {request.method} {request.url.path} -> ERROR: {e}", flush=True)
        sys.stdout.flush()
        raise


app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(documents.router)
app.include_router(export.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[!] Unhandled exception: {type(exc).__name__}: {exc}", flush=True)
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred"}
    )


@app.get("/")
async def root():
    return {"status": "ok", "service": "Merry", "version": "1.0.0"}


@app.get("/health")
async def health():
    config = get_config()
    return {
        "status": "healthy",
        "database": bool(config.supabase.db_url),
        "ai": True,
        "search": True,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, access_log=True)
