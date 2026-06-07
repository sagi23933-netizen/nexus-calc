from __future__ import annotations

from fastapi import APIRouter, UploadFile

from ..tools.file_reader import read_file_text
from .deps import get_state

router = APIRouter(prefix="/api/files", tags=["files"])


@router.post("/upload")
async def upload_file(file: UploadFile) -> dict:
    """Save an upload, extract text, and ingest it into the RAG index."""
    st = get_state()
    dest = st.settings.uploads_path / (file.filename or "upload.bin")
    dest.write_bytes(await file.read())

    extracted = read_file_text(dest)
    if not extracted.get("ok"):
        return {"ok": False, "error": extracted.get("error"), "filename": dest.name}

    chunks = await st.rag.ingest(extracted["text"], source=dest.name)
    return {"ok": True, "filename": dest.name, "chunks_indexed": chunks, "vectors_total": st.vector_store.count()}
