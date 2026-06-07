"""Shared application state.

Built once at startup and injected into routes. Keeps wiring in one place.
"""
from __future__ import annotations

from ..core.config import settings
from ..core.model_router import ModelRouter
from ..core.prompt_compiler import PromptCompiler
from ..core.reasoning_engine import ReasoningEngine
from ..memory import RagPipeline, SqliteStore, VectorStore


class AppState:
    def __init__(self) -> None:
        settings.ensure_dirs()
        self.settings = settings
        self.router = ModelRouter(settings)
        self.compiler = PromptCompiler()
        self.store = SqliteStore(settings.sqlite_path)
        self.vector_store = VectorStore(settings.vector_path)
        self.rag = RagPipeline(self.vector_store, settings.ollama_base_url)
        self.engine = ReasoningEngine(self.router, self.compiler, memory=self.rag)


state: AppState | None = None


def get_state() -> AppState:
    global state
    if state is None:
        state = AppState()
    return state
