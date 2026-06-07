from __future__ import annotations

from ..core.model_router import ModelRouter
from ..core.prompt_compiler import PromptCompiler


class Planner:
    """Turns a user request into a structured plan. Never solves the task."""

    def __init__(self, router: ModelRouter, compiler: PromptCompiler) -> None:
        self.router = router
        self.compiler = compiler

    async def run(self, user_prompt: str, context: str, model_id: str) -> str:
        prompt = self.compiler.compile("planner", user_prompt=user_prompt, context=context)
        # Planning benefits from low temperature and a smaller budget.
        return await self.router.generate(model_id, prompt, {"temperature": 0.2, "max_tokens": 1024})
