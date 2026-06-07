"""Embeddings.

Primary path: Ollama's /api/embeddings (e.g. nomic-embed-text). If that is
unavailable, fall back to a deterministic hashing embedding so the RAG pipeline
still functions end-to-end in development (lower quality, but no setup).
"""
from __future__ import annotations

import hashlib

import httpx

_DIM = 256


async def embed_text(text: str, ollama_base_url: str, model: str = "nomic-embed-text") -> list[float]:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{ollama_base_url.rstrip('/')}/api/embeddings",
                json={"model": model, "prompt": text},
            )
            resp.raise_for_status()
            emb = resp.json().get("embedding")
            if emb:
                return emb
    except Exception:
        pass
    return _hash_embedding(text)


def _hash_embedding(text: str, dim: int = _DIM) -> list[float]:
    """Deterministic bag-of-words hashing embedding (dev fallback only)."""
    vec = [0.0] * dim
    for token in text.lower().split():
        h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
        vec[h % dim] += 1.0
    norm = sum(v * v for v in vec) ** 0.5
    return [v / norm for v in vec] if norm else vec
