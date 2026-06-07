"""Task classifier.

A cheap heuristic pass runs first (no model call). Only ambiguous cases fall
through to a single fast model call, keeping latency low.
"""
from __future__ import annotations

import re

from .model_router import ModelRouter
from .prompt_compiler import PromptCompiler

LABELS = {"general", "coding", "math", "research", "planning", "writing"}

_CODE_HINTS = re.compile(r"\b(code|function|bug|python|javascript|typescript|api|class|compile|stack ?trace|regex)\b", re.I)
_MATH_HINTS = re.compile(r"\b(calculate|compute|equation|integral|derivative|probability|solve for|percentage)\b|[0-9]\s*[-+*/^]\s*[0-9]", re.I)
_RESEARCH_HINTS = re.compile(r"\b(research|sources?|cite|according to|literature|compare studies|evidence)\b", re.I)
_PLANNING_HINTS = re.compile(r"\b(plan|roadmap|strategy|steps to|break down|milestones|timeline)\b", re.I)
_WRITING_HINTS = re.compile(r"\b(write|draft|essay|email|story|rewrite|summari[sz]e|tone)\b", re.I)


class TaskClassifier:
    def __init__(self, router: ModelRouter, compiler: PromptCompiler) -> None:
        self.router = router
        self.compiler = compiler

    def heuristic(self, user_prompt: str) -> str | None:
        if _CODE_HINTS.search(user_prompt):
            return "coding"
        if _MATH_HINTS.search(user_prompt):
            return "math"
        if _RESEARCH_HINTS.search(user_prompt):
            return "research"
        if _PLANNING_HINTS.search(user_prompt):
            return "planning"
        if _WRITING_HINTS.search(user_prompt):
            return "writing"
        return None

    async def classify(self, user_prompt: str, model_id: str) -> str:
        guess = self.heuristic(user_prompt)
        if guess:
            return guess
        prompt = self.compiler.compile("classifier", user_prompt=user_prompt)
        try:
            raw = await self.router.generate(model_id, prompt, {"temperature": 0.0, "max_tokens": 8})
            label = raw.strip().split()[0].lower().strip(".:,")
            return label if label in LABELS else "general"
        except Exception:
            return "general"
