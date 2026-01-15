"""Export Router"""
from uuid import UUID
from fastapi import APIRouter, HTTPException, Response, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.connection import get_session
from db.models import DocumentModel
from export import export_word_document, export_excel_document, export_pdf_document

router = APIRouter(prefix="/api/documents", tags=["Export"])


async def get_document(doc_id: str, session: AsyncSession) -> DocumentModel:
    try:
        document_id = UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document ID")
    
    result = await session.execute(select(DocumentModel).where(DocumentModel.id == document_id))
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return document


def doc_to_dict(doc: DocumentModel) -> dict:
    content = doc.content or {}
    return {
        "id": str(doc.id),
        "type": doc.type,
        "title": doc.title,
        "sections": content.get("sections", []),
        "sheets": content.get("sheets", []),
    }


@router.get("/{doc_id}/export/word")
async def export_word(doc_id: str, session: AsyncSession = Depends(get_session)):
    document = await get_document(doc_id, session)
    
    if document.type != "word":
        raise HTTPException(status_code=400, detail="Not a Word document")
    
    try:
        doc_dict = doc_to_dict(document)
        docx_bytes = export_word_document(doc_dict)
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{document.title}.docx"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{doc_id}/export/excel")
async def export_excel(doc_id: str, session: AsyncSession = Depends(get_session)):
    document = await get_document(doc_id, session)
    
    if document.type != "excel":
        raise HTTPException(status_code=400, detail="Not an Excel document")
    
    try:
        doc_dict = doc_to_dict(document)
        xlsx_bytes = export_excel_document(doc_dict)
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{document.title}.xlsx"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{doc_id}/export/pdf")
async def export_pdf(doc_id: str, session: AsyncSession = Depends(get_session)):
    document = await get_document(doc_id, session)
    
    try:
        doc_dict = doc_to_dict(document)
        pdf_bytes = export_pdf_document(doc_dict)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{document.title}.pdf"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
