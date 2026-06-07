from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from ..core.config import BACKEND_DIR, settings
from ..evals.benchmark_runner import run_benchmark
from .deps import get_state

router = APIRouter(prefix="/api/evals", tags=["evals"])

TEST_SETS_DIR = BACKEND_DIR / "evals" / "test_sets"


class BenchmarkRequest(BaseModel):
    model_id: str | None = None
    mode: str = "deep"
    test_set: str = "starter"
    cases: list[dict] | None = None


@router.get("/test-sets")
async def list_test_sets() -> dict:
    return {"test_sets": [p.stem for p in TEST_SETS_DIR.glob("*.json")]}


@router.post("/run")
async def run(req: BenchmarkRequest) -> dict:
    st = get_state()
    model_id = req.model_id or settings.default_model

    cases = req.cases
    if cases is None:
        path: Path = TEST_SETS_DIR / f"{req.test_set}.json"
        if not path.exists():
            return {"ok": False, "error": f"test set not found: {req.test_set}"}
        cases = json.loads(path.read_text(encoding="utf-8"))

    report = await run_benchmark(st.engine, model_id, cases, mode=req.mode)
    return {"ok": True, **report}
