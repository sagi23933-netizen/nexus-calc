"""Extract plain text from uploaded files.

Handles .txt/.md natively and .pdf when pypdf is installed. Returns text plus a
short note about what was read so the caller can surface it in the trace.
"""
from __future__ import annotations

from pathlib import Path


def read_file_text(path: str | Path) -> dict:
    p = Path(path)
    if not p.exists():
        return {"ok": False, "error": f"file not found: {p}", "text": ""}

    suffix = p.suffix.lower()
    try:
        if suffix in {".txt", ".md", ".csv", ".json", ".py", ".js", ".ts"}:
            return {"ok": True, "text": p.read_text(encoding="utf-8", errors="replace"), "kind": suffix}
        if suffix == ".pdf":
            return _read_pdf(p)
        # Fallback: best-effort text decode.
        return {"ok": True, "text": p.read_text(encoding="utf-8", errors="replace"), "kind": "raw"}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "text": ""}


def _read_pdf(p: Path) -> dict:
    try:
        from pypdf import PdfReader
    except ImportError:
        return {"ok": False, "error": "pypdf not installed (pip install pypdf)", "text": ""}
    reader = PdfReader(str(p))
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    return {"ok": True, "text": text, "kind": ".pdf", "pages": len(reader.pages)}
