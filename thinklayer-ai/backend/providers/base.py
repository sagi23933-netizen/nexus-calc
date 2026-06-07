"""Provider abstraction.

Every backend (Ollama, LM Studio, llama.cpp) implements the same tiny surface
so the rest of the system never needs to know which engine is answering.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Any


@dataclass
class GenerationOptions:
    temperature: float = 0.3
    max_tokens: int = 2048
    stop: list[str] | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "GenerationOptions":
        data = data or {}
        return cls(
            temperature=float(data.get("temperature", 0.3)),
            max_tokens=int(data.get("max_tokens", 2048)),
            stop=data.get("stop"),
        )


class Provider(abc.ABC):
    """A text-generation backend addressed by a bare model name (no prefix)."""

    name: str = "base"

    @abc.abstractmethod
    async def generate(self, model: str, prompt: str, options: GenerationOptions) -> str:
        ...

    @abc.abstractmethod
    async def list_models(self) -> list[str]:
        ...

    async def health(self) -> bool:
        try:
            await self.list_models()
            return True
        except Exception:
            return False
