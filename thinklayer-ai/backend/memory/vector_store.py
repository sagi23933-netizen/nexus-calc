"""Tiny in-process vector store.

A dependency-free cosine-similarity store so the RAG pipeline runs out of the
box. Swap this for Chroma or LanceDB later — the interface (add / query) is
intentionally the same shape those libraries use.
"""
from __future__ import annotations

import json
import math
from pathlib import Path


class VectorStore:
    def __init__(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        self.file = path / "vectors.jsonl"
        self.records: list[dict] = []
        self._load()

    def _load(self) -> None:
        if self.file.exists():
            self.records = [json.loads(line) for line in self.file.read_text(encoding="utf-8").splitlines() if line]

    def _persist(self) -> None:
        self.file.write_text("\n".join(json.dumps(r) for r in self.records), encoding="utf-8")

    def add(self, text: str, embedding: list[float], metadata: dict | None = None) -> None:
        self.records.append({"text": text, "embedding": embedding, "metadata": metadata or {}})
        self._persist()

    def query(self, embedding: list[float], top_k: int = 5) -> list[dict]:
        scored = [(_cosine(embedding, r["embedding"]), r) for r in self.records]
        scored.sort(key=lambda x: x[0], reverse=True)
        out = []
        for score, rec in scored[:top_k]:
            out.append({"text": rec["text"], "score": score, "metadata": rec["metadata"]})
        return out

    def count(self) -> int:
        return len(self.records)


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0
