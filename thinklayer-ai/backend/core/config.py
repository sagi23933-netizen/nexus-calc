"""Central configuration for the ThinkLayer backend.

Values can be overridden with environment variables so the same code runs
against a local Ollama instance, an LM Studio server, or a llama.cpp server
without code changes.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
PROMPTS_DIR = BACKEND_DIR / "prompts"


def _env(key: str, default: str) -> str:
    return os.environ.get(key, default)


@dataclass
class Settings:
    # Provider endpoints. The model_id prefix (ollama:, lmstudio:, llamacpp:)
    # decides which one is used, so all three can coexist.
    ollama_base_url: str = field(default_factory=lambda: _env("OLLAMA_BASE_URL", "http://localhost:11434"))
    lmstudio_base_url: str = field(default_factory=lambda: _env("LMSTUDIO_BASE_URL", "http://localhost:1234"))
    llamacpp_base_url: str = field(default_factory=lambda: _env("LLAMACPP_BASE_URL", "http://localhost:8080"))

    # Default model used when the client does not specify one.
    default_model: str = field(default_factory=lambda: _env("THINKLAYER_DEFAULT_MODEL", "ollama:llama3.2"))

    # Storage
    sqlite_path: Path = field(default_factory=lambda: DATA_DIR / "sqlite" / "thinklayer.db")
    vector_path: Path = field(default_factory=lambda: DATA_DIR / "vector")
    uploads_path: Path = field(default_factory=lambda: DATA_DIR / "uploads")

    request_timeout_s: float = field(default_factory=lambda: float(_env("THINKLAYER_TIMEOUT", "120")))

    def ensure_dirs(self) -> None:
        self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        self.vector_path.mkdir(parents=True, exist_ok=True)
        self.uploads_path.mkdir(parents=True, exist_ok=True)


settings = Settings()
