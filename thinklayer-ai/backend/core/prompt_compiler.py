"""Prompt compiler.

The orchestrator never sends a free-form prompt to a small model. Each stage
gets a tight, role-specific template loaded from backend/prompts/*.md and
filled with {{placeholders}}. Templates are cached after first read.
"""
from __future__ import annotations

from pathlib import Path

from .config import PROMPTS_DIR


class PromptCompiler:
    def __init__(self, prompts_dir: Path = PROMPTS_DIR) -> None:
        self.prompts_dir = prompts_dir
        self._cache: dict[str, str] = {}

    def _load(self, name: str) -> str:
        if name not in self._cache:
            path = self.prompts_dir / f"{name}.md"
            self._cache[name] = path.read_text(encoding="utf-8")
        return self._cache[name]

    def compile(self, template_name: str, **variables: str) -> str:
        text = self._load(template_name)
        for key, value in variables.items():
            text = text.replace("{{" + key + "}}", value if value is not None else "")
        # Blank out any placeholders the caller did not supply.
        for leftover in ("user_prompt", "plan", "context", "draft", "answer", "critique", "verification", "task_type"):
            text = text.replace("{{" + leftover + "}}", "")
        return text
