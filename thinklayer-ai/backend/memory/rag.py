"""RAG pipeline: chunk -> embed -> store -> retrieve.

Keep context small for small models — a few highly relevant chunks beat a large
dump that the model gets lost in.
"""
from __future__ import annotations

from .embeddings import embed_text
from .vector_store import VectorStore


def chunk_text(text: str, chunk_size: int = 700, overlap: int = 120) -> list[str]:
    """Word-based chunking with overlap (approx tokens via words)."""
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start = end - overlap
    return chunks


class RagPipeline:
    def __init__(self, vector_store: VectorStore, ollama_base_url: str, top_k: int = 5) -> None:
        self.store = vector_store
        self.ollama_base_url = ollama_base_url
        self.top_k = top_k

    async def ingest(self, text: str, source: str) -> int:
        chunks = chunk_text(text)
        for i, chunk in enumerate(chunks):
            emb = await embed_text(chunk, self.ollama_base_url)
            self.store.add(chunk, emb, {"source": source, "chunk": i})
        return len(chunks)

    async def retrieve(self, query: str) -> list[dict]:
        if self.store.count() == 0:
            return []
        emb = await embed_text(query, self.ollama_base_url)
        return self.store.query(emb, top_k=self.top_k)
