"""ThinkLayer AI — FastAPI entry point.

Run from the project root (thinklayer-ai/):

    uvicorn backend.main:app --reload --port 8000
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import chat_routes, eval_routes, file_routes, model_routes
from .api.deps import get_state
from .tools import available_tools

app = FastAPI(title="ThinkLayer AI", version="0.1.0")

# The desktop app runs on a local origin; allow all in dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_routes.router)
app.include_router(model_routes.router)
app.include_router(file_routes.router)
app.include_router(eval_routes.router)


@app.on_event("startup")
async def _startup() -> None:
    # Eagerly build app state so the first request is not slow.
    get_state()


@app.get("/api/health")
async def health() -> dict:
    st = get_state()
    return {
        "status": "ok",
        "version": "0.1.0",
        "default_model": st.settings.default_model,
        "tools": available_tools(),
        "modes": ["fast", "deep", "research", "coding", "math", "agent"],
    }


@app.get("/")
async def root() -> dict:
    return {"name": "ThinkLayer AI", "docs": "/docs", "health": "/api/health"}
