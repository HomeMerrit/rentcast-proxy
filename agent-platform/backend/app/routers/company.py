"""Company profile and document upload / ingestion endpoints."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models_db import Company, Document, Organization
from ..tenancy import get_current_org
from ..schemas import CompanyCreate, CompanyUpdate, CompanyOut, DocumentOut
from ..memory.manager import memory_manager

router = APIRouter()


async def _get_company_in_org(company_id: UUID, org: Organization, db: AsyncSession) -> Company:
    result = await db.execute(select(Company).where(Company.id == company_id, Company.org_id == org.id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(404, "Company not found")
    return company

CHUNK_SIZE = 1000

# Content types we attempt to decode + embed as text.
TEXT_CONTENT_TYPES = {
    "text/plain", "text/markdown", "text/csv", "application/json",
    "text/x-markdown", "application/csv",
}
TEXT_EXTENSIONS = (".txt", ".md", ".markdown", ".csv", ".json")


def _is_text_document(filename: str, content_type: str | None) -> bool:
    if content_type and (content_type in TEXT_CONTENT_TYPES or content_type.startswith("text/")):
        return True
    return filename.lower().endswith(TEXT_EXTENSIONS)


def _chunk_text(text: str, size: int = CHUNK_SIZE) -> list[str]:
    return [text[i:i + size] for i in range(0, len(text), size) if text[i:i + size].strip()]


@router.post("/company", response_model=CompanyOut, status_code=201)
async def create_company(body: CompanyCreate, db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
    company = Company(**body.model_dump(), org_id=org.id)
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company


@router.get("/company", response_model=list[CompanyOut])
async def list_companies(db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
    result = await db.execute(select(Company).where(Company.org_id == org.id).order_by(Company.created_at))
    return result.scalars().all()


@router.get("/company/{company_id}", response_model=CompanyOut)
async def get_company(company_id: UUID, db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
    return await _get_company_in_org(company_id, org, db)


@router.patch("/company/{company_id}", response_model=CompanyOut)
async def update_company(company_id: UUID, body: CompanyUpdate, db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
    company = await _get_company_in_org(company_id, org, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(company, field, value)
    await db.commit()
    await db.refresh(company)
    return company


@router.post("/company/{company_id}/documents", response_model=list[DocumentOut], status_code=201)
async def upload_documents(
    company_id: UUID,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    org: Organization = Depends(get_current_org),
):
    company = await _get_company_in_org(company_id, org, db)

    created: list[Document] = []
    namespace = str(company_id)

    for upload in files:
        raw = await upload.read()
        size_bytes = len(raw)
        content_type = upload.content_type
        filename = upload.filename or "untitled"

        chunk_count = 0
        status = "ingested"

        if _is_text_document(filename, content_type):
            text = raw.decode("utf-8", errors="ignore")
            chunks = _chunk_text(text)
            for chunk in chunks:
                await memory_manager.add(
                    agent_id=namespace,
                    content=chunk,
                    task_type="document",
                    metadata={"filename": filename, "company_id": namespace},
                )
            chunk_count = len(chunks)
            status = "ingested"
        else:
            # Binary / PDF: store metadata only, skip embedding.
            status = "stored"

        doc = Document(
            org_id=org.id,
            company_id=company_id,
            filename=filename,
            content_type=content_type,
            size_bytes=size_bytes,
            status=status,
            chunk_count=chunk_count,
        )
        db.add(doc)
        created.append(doc)

    await db.commit()
    for doc in created:
        await db.refresh(doc)
    return created


@router.get("/company/{company_id}/documents", response_model=list[DocumentOut])
async def list_documents(company_id: UUID, db: AsyncSession = Depends(get_db), org: Organization = Depends(get_current_org)):
    await _get_company_in_org(company_id, org, db)
    result = await db.execute(
        select(Document).where(Document.company_id == company_id, Document.org_id == org.id).order_by(Document.created_at)
    )
    return result.scalars().all()
