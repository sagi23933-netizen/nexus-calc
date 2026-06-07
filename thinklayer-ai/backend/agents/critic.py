from __future__ import annotations

import re

from ..core.model_router import ModelRouter
from ..core.prompt_compiler import PromptCompiler


class Critic:
    """Reviews a draft and returns structured feedback + a confidence score."""

    def __init__(self, router: ModelRouter, compiler: PromptCompiler) -> None:
        self.router = router
        self.compiler = compiler

    async def run(self, user_prompt: str, draft: str, model_id: str) -> str:
        prompt = self.compiler.compile("critic", user_prompt=user_prompt, draft=draft)
        return await self.router.generate(model_id, prompt, {"temperature": 0.2, "max_tokens": 1024})

    async def repair(self, user_prompt: str, draft: str, critique: str, model_id: str) -> str:
        prompt = self.compiler.compile("repair", user_prompt=user_prompt, draft=draft, critique=critique)
        return await self.router.generate(model_id, prompt, {"temperature": 0.3, "max_tokens": 2048})

    @staticmethod
    def confidence(critique: str) -> int | None:
        return _extract_score(critique)


def _extract_score(text: str) -> int | None:
    match = re.search(r"CONFIDENCE_SCORE_0_TO_100\s*:?\s*(\d{1,3})", text, re.IGNORECASE)
    if not match:
        return None
    return max(0, min(100, int(match.group(1))))
