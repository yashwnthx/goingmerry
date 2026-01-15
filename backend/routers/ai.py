"""AI Router"""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from ai import get_ai_client
from services.errors import ValidationError, ServiceError, handle_errors

router = APIRouter(prefix="/api/ai", tags=["AI"])


class IntentRequest(BaseModel):
    prompt: str = Field(..., min_length=10, max_length=2000)


class IntentResponse(BaseModel):
    document_type: str
    topic: str
    tone: str = "formal"
    sections: list[dict] = []
    columns: list[str] = []
    sample_data: list[dict] = []


class RewriteRequest(BaseModel):
    section_id: str = Field(..., min_length=1)
    instructions: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1, max_length=10000)
    preserve_heading: bool = True
    search_query: str | None = None


class RewriteResponse(BaseModel):
    content: str


class ColumnSuggestRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)


@router.post("/parse-intent", response_model=IntentResponse)
@handle_errors
async def parse_intent(request: IntentRequest):
    prompt = request.prompt.strip()
    
    if len(prompt) < 10:
        raise ValidationError("Please provide more details (at least 10 characters)")
    
    try:
        client = get_ai_client()
        result = await client.parse_intent_async(prompt)
        
        # Validate response has required fields
        if not result.get("document_type"):
            result["document_type"] = "word"
        if not result.get("topic"):
            result["topic"] = prompt[:50]
        
        return IntentResponse(**result)
    except Exception as e:
        print(f"[!] AI parse_intent error: {type(e).__name__}: {e}", flush=True)
        import traceback
        traceback.print_exc()
        raise ServiceError(f"AI service error: {str(e)}")


@router.post("/rewrite", response_model=RewriteResponse)
@handle_errors
async def rewrite_section(request: RewriteRequest):
    try:
        client = get_ai_client()
        
        if request.search_query:
            content = await client.rewrite_with_search(
                content=request.content,
                instructions=request.instructions,
                search_query=request.search_query,
            )
        else:
            content = client.rewrite_section(
                content=request.content,
                instructions=request.instructions,
                preserve_heading=request.preserve_heading,
            )
        
        if not content:
            raise ServiceError("AI returned empty response")
        
        return RewriteResponse(content=content)
    except Exception as e:
        raise ServiceError(f"Rewrite failed: {str(e)}")


@router.post("/suggest-columns")
@handle_errors
async def suggest_columns(request: ColumnSuggestRequest):
    try:
        client = get_ai_client()
        columns = client.suggest_columns(request.topic)
        return {"columns": columns}
    except Exception as e:
        raise ServiceError(f"Column suggestion failed: {str(e)}")
