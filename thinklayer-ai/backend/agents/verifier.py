from __future__ import annotations

import re

from ..core.model_router import ModelRouter
from ..core.prompt_compiler import PromptCompiler


class Verifier:
    """Decides whether the answer is ready and returns a confidence score."""

    def __init__(self, router: ModelRouter, compiler: PromptCompiler) -> None:
        self.router = router
        self.compiler = compiler

    async def run(self, user_prompt: str, answer: str, model_id: str) -> str:
        prompt = self.compiler.compile("verifier", user_prompt=user_prompt, answer=answer)
        return await self.router.generate(model_id, prompt, {"temperature": 0.1, "max_tokens": 768})

    @staticmethod
    def is_ready(verification: str) -> bool:
        match = re.search(r"READY\s*:?\s*(yes|no)", verification, re.IGNORECASE)
        return bool(match) and match.group(1).lower() == "yes"

    @staticmethod
    def confidence(verification: str) -> int | None:
        match = re.search(r"CONFIDENCE_SCORE_0_TO_100\s*:?\s*(\d{1,3})", verification, re.IGNORECASE)
        if not match:
            return None
        return max(0, min(100, int(match.group(1))))
