"""Lightweight scoring helpers for benchmarks.

Two cheap signals that need no labels:
- length/structure heuristics (completeness proxy)
- the engine's own verifier confidence

Plus exact/keyword match when a reference answer is supplied in a test set.
"""
from __future__ import annotations

import re


def keyword_score(answer: str, expected_keywords: list[str]) -> float:
    if not expected_keywords:
        return 0.0
    hits = sum(1 for kw in expected_keywords if kw.lower() in answer.lower())
    return hits / len(expected_keywords)


def exact_match(answer: str, reference: str) -> bool:
    norm = lambda s: re.sub(r"\s+", " ", s.strip().lower())
    return norm(answer) == norm(reference)


def structure_score(answer: str) -> float:
    """Rough proxy for completeness: rewards lists, headings, code blocks."""
    score = 0.0
    if len(answer) > 200:
        score += 0.4
    if re.search(r"^\s*[-*\d]", answer, re.MULTILINE):
        score += 0.3
    if "```" in answer or re.search(r"#{1,6}\s", answer):
        score += 0.3
    return min(1.0, score)
