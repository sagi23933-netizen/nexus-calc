from __future__ import annotations

from ..core.model_router import ModelRouter
from ..core.prompt_compiler import PromptCompiler


class Solver:
    """Produces a draft answer by following the plan."""

    def __init__(self, router: ModelRouter, compiler: PromptCompiler) -> None:
        self.router = router
        self.compiler = compiler

    async def run(self, user_prompt: str, plan: str, context: str, model_id: str, temperature: float = 0.3) -> str:
        prompt = self.compiler.compile("solver", user_prompt=user_prompt, plan=plan, context=context)
        return await self.router.generate(model_id, prompt, {"temperature": temperature, "max_tokens": 2048})
