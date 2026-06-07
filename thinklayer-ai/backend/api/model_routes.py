from __future__ import annotations

from fastapi import APIRouter

from .deps import get_state

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
async def list_models() -> dict:
    st = get_state()
    models = await st.router.list_all_models()
    return {"models": models, "default": st.settings.default_model}
