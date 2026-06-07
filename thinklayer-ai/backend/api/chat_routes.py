from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from ..core.config import settings
from ..core.reasoning_engine import ReasoningConfig
from .deps import get_state

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    prompt: str
    model_id: str | None = None
    conversation_id: str | None = None
    mode: str = "deep"
    use_rag: bool = False
    verify: bool = True
    temperature: float = 0.3


@router.post("")
async def chat(req: ChatRequest) -> dict:
    st = get_state()
    model_id = req.model_id or settings.default_model

    conversation_id = req.conversation_id or st.store.create_conversation(title=req.prompt[:60])
    st.store.add_message(conversation_id, "user", req.prompt)

    config = ReasoningConfig(
        mode=req.mode,
        use_rag=req.use_rag,
        verify=req.verify,
        temperature=req.temperature,
    )
    result = await st.engine.run(req.prompt, model_id, config)

    st.store.add_message(conversation_id, "assistant", result.final_answer, metadata=result.metadata)

    payload = result.to_dict()
    payload["conversation_id"] = conversation_id
    return payload


@router.get("/conversations")
async def list_conversations() -> dict:
    st = get_state()
    return {"conversations": st.store.list_conversations()}


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str) -> dict:
    st = get_state()
    return {"messages": st.store.get_messages(conversation_id)}
