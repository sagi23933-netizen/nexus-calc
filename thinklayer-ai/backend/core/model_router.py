"""Model router.

Hides the differences between Ollama, LM Studio and llama.cpp behind a single
`generate(model_id, prompt, options)` call. Model ids are prefixed so the
router knows where to send the request, e.g.:

    ollama:llama3.2
    lmstudio:qwen2.5-7b-instruct
    llamacpp:phi-3-mini
"""
from __future__ import annotations

from ..providers import GenerationOptions, OllamaProvider, OpenAICompatibleProvider, Provider
from .config import Settings


class ModelRouter:
    def __init__(self, settings: Settings) -> None:
        self.providers: dict[str, Provider] = {
            "ollama": OllamaProvider(settings.ollama_base_url, settings.request_timeout_s),
            "lmstudio": OpenAICompatibleProvider("lmstudio", settings.lmstudio_base_url, settings.request_timeout_s),
            "llamacpp": OpenAICompatibleProvider("llamacpp", settings.llamacpp_base_url, settings.request_timeout_s),
        }

    @staticmethod
    def split(model_id: str) -> tuple[str, str]:
        """Return (provider_name, bare_model_name)."""
        if ":" not in model_id:
            # No prefix -> assume ollama for ergonomics.
            return "ollama", model_id
        prefix, _, rest = model_id.partition(":")
        if prefix not in {"ollama", "lmstudio", "llamacpp"}:
            # e.g. "llama3.2:3b" — a tag, not a provider prefix.
            return "ollama", model_id
        return prefix, rest

    def resolve_provider(self, model_id: str) -> Provider:
        provider_name, _ = self.split(model_id)
        provider = self.providers.get(provider_name)
        if provider is None:
            raise ValueError(f"Unknown model provider for model: {model_id}")
        return provider

    async def generate(self, model_id: str, prompt: str, options: dict | GenerationOptions | None = None) -> str:
        opts = options if isinstance(options, GenerationOptions) else GenerationOptions.from_dict(options)
        provider = self.resolve_provider(model_id)
        _, bare = self.split(model_id)
        return await provider.generate(bare, prompt, opts)

    async def list_all_models(self) -> list[dict]:
        out: list[dict] = []
        for name, provider in self.providers.items():
            try:
                for model in await provider.list_models():
                    out.append({"id": f"{name}:{model}", "provider": name, "name": model, "available": True})
            except Exception:
                # Provider offline — surface it as unavailable rather than crash.
                out.append({"id": f"{name}:*", "provider": name, "name": None, "available": False})
        return out
