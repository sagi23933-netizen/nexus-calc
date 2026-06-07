from __future__ import annotations

from ..core.model_router import ModelRouter
from ..core.prompt_compiler import PromptCompiler


class Finalizer:
    """Polishes the verified answer into the final user-facing response."""

    def __init__(self, router: ModelRouter, compiler: PromptCompiler) -> None:
        self.router = router
        self.compiler = compiler

    async def run(self, user_prompt: str, answer: str, verification: str, model_id: str) -> str:
        prompt = self.compiler.compile(
            "finalizer", user_prompt=user_prompt, answer=answer, verification=verification
        )
        return await self.router.generate(model_id, prompt, {"temperature": 0.2, "max_tokens": 2048})
