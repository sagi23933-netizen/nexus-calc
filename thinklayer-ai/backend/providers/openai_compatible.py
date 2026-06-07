"""OpenAI-compatible provider.

Both LM Studio and a llama.cpp server expose an OpenAI-style
/v1/chat/completions endpoint, so a single implementation covers both — only
the base URL and the provider label differ.
"""
from __future__ import annotations

import httpx

from .base import GenerationOptions, Provider


class OpenAICompatibleProvider(Provider):
    def __init__(self, name: str, base_url: str, timeout_s: float = 120.0) -> None:
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s

    async def generate(self, model: str, prompt: str, options: GenerationOptions) -> str:
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": options.temperature,
            "max_tokens": options.max_tokens,
            "stream": False,
        }
        if options.stop:
            payload["stop"] = options.stop

        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            resp = await client.post(f"{self.base_url}/v1/chat/completions", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return (data["choices"][0]["message"]["content"] or "").strip()

    async def list_models(self) -> list[str]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{self.base_url}/v1/models")
            resp.raise_for_status()
            data = resp.json()
            return [m["id"] for m in data.get("data", [])]
