"""Documents Router"""
from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from db.connection import get_session
from db.models import DocumentModel
from routers.auth import get_current_user
from services.errors import NotFoundError, ForbiddenError, ValidationError, handle_errors

router = APIRouter(prefix="/api/documents", tags=["Documents"])


class DocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    type: str = Field(..., pattern="^(word|excel)$")
    sections: list[dict] = []
    sheets: list[dict] = []

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: str) -> str:
        return v.strip()

    @field_validator('type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ('word', 'excel'):
            raise ValueError('Type must be "word" or "excel"')
        return v


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    sections: Optional[list[dict]] = None
    sheets: Optional[list[dict]] = None


class DocumentMeta(BaseModel):
    version: int = 1
    created_at: str
    updated_at: str
    schema_version: str = "1.0.0"
    sources: list = []


class DocumentResponse(BaseModel):
    id: str
    type: str
    title: str
    meta: DocumentMeta
    sections: list[dict]
    sheets: list[dict]


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]


def to_response(doc: DocumentModel) -> DocumentResponse:
    content = doc.content or {}
    return DocumentResponse(
        id=str(doc.id),
        type=doc.type,
        title=doc.title,
        meta=DocumentMeta(
            version=doc.current_version,
            created_at=doc.created_at.isoformat() + "Z",
            updated_at=doc.updated_at.isoformat() + "Z",
            schema_version=doc.schema_version,
            sources=content.get("sources", []),
        ),
        sections=content.get("sections", []),
        sheets=content.get("sheets", []),
    )


def parse_uuid(value: str) -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise ValidationError("Invalid ID format")


def get_user_id(user: Optional[dict]) -> Optional[UUID]:
    if not user or "id" not in user:
        return None
    try:
        return UUID(user["id"])
    except (ValueError, TypeError):
        return None


async def get_document_with_access(
    doc_id: str,
    session: AsyncSession,
    user: Optional[dict],
    require_owner: bool = False
) -> DocumentModel:
    document_id = parse_uuid(doc_id)
    user_id = get_user_id(user)
    
    result = await session.execute(
        select(DocumentModel).where(DocumentModel.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise NotFoundError("Document")
    
    if document.user_id:
        if not user_id:
            raise ForbiddenError("Sign in to access this document")
        if document.user_id != user_id:
            raise ForbiddenError("You don't have access to this document")
    elif require_owner and not user_id:
        raise ForbiddenError("Sign in to modify this document")
    
    return document


@router.post("", response_model=DocumentResponse)
@handle_errors
async def create_document(
    doc: DocumentCreate,
    session: AsyncSession = Depends(get_session),
    user: Optional[dict] = Depends(get_current_user),
):
    if doc.type == 'word' and not doc.sections:
        raise ValidationError("Word documents require at least one section")
    if doc.type == 'excel' and not doc.sheets:
        raise ValidationError("Excel documents require at least one sheet")

    user_id = get_user_id(user)
    now = datetime.utcnow()
    
    document = DocumentModel(
        id=uuid4(),
        user_id=user_id,
        type=doc.type,
        title=doc.title,
        content={"sections": doc.sections, "sheets": doc.sheets, "sources": []},
        current_version=1,
        created_at=now,
        updated_at=now,
    )
    session.add(document)
    await session.flush()
    await session.refresh(document)
    return to_response(document)


@router.get("/{doc_id}", response_model=DocumentResponse)
@handle_errors
async def get_document(
    doc_id: str,
    session: AsyncSession = Depends(get_session),
    user: Optional[dict] = Depends(get_current_user),
):
    document = await get_document_with_access(doc_id, session, user)
    return to_response(document)


@router.get("", response_model=DocumentListResponse)
@handle_errors
async def list_documents(
    session: AsyncSession = Depends(get_session),
    user: Optional[dict] = Depends(get_current_user),
):
    user_id = get_user_id(user)
    if not user_id:
        return DocumentListResponse(documents=[])
    
    result = await session.execute(
        select(DocumentModel)
        .where(DocumentModel.user_id == user_id)
        .order_by(desc(DocumentModel.updated_at))
    )
    return DocumentListResponse(
        documents=[to_response(doc) for doc in result.scalars().all()]
    )


@router.put("/{doc_id}", response_model=DocumentResponse)
@handle_errors
async def update_document(
    doc_id: str,
    update: DocumentUpdate,
    session: AsyncSession = Depends(get_session),
    user: Optional[dict] = Depends(get_current_user),
):
    document = await get_document_with_access(doc_id, session, user)
    
    if update.title is not None:
        document.title = update.title.strip()
    
    content = document.content or {}
    if update.sections is not None:
        content["sections"] = update.sections
    if update.sheets is not None:
        content["sheets"] = update.sheets
    
    document.content = content
    document.updated_at = datetime.utcnow()
    document.current_version += 1
    
    await session.flush()
    await session.refresh(document)
    return to_response(document)


@router.delete("/{doc_id}")
@handle_errors
async def delete_document(
    doc_id: str,
    session: AsyncSession = Depends(get_session),
    user: Optional[dict] = Depends(get_current_user),
):
    document = await get_document_with_access(doc_id, session, user, require_owner=True)
    await session.delete(document)
    return {"success": True, "id": doc_id}
