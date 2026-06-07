"""Offline smoke test — no model server required.

Verifies wiring by stubbing the model router with a fake generator, then runs
the full pipeline, the calculator tool, and a benchmark. Run from project root:

    python -m backend.smoke_test
"""
from __future__ import annotations

import asyncio

from backend.core.prompt_compiler import PromptCompiler
from backend.core.reasoning_engine import ReasoningConfig, ReasoningEngine
from backend.evals.benchmark_runner import run_benchmark
from backend.tools.calculator import calculate


class FakeRouter:
    """Returns canned stage-appropriate text so we can exercise the pipeline."""

    async def generate(self, model_id, prompt, options=None):
        if "planning module" in prompt:
            return "TASK_TYPE: general\nSUBTASKS:\n- step 1\n- step 2\nSUCCESS_CRITERIA: answers the user"
        if "critic module" in prompt:
            return "CRITICAL_ISSUES: none\nMINOR_ISSUES: tighten wording\nCONFIDENCE_SCORE_0_TO_100: 82"
        if "verifier module" in prompt:
            return "READY: yes\nREASONS: complete\nCONFIDENCE_SCORE_0_TO_100: 88"
        if "task classifier" in prompt:
            return "general"
        if "repair module" in prompt or "finalizer module" in prompt:
            return "- point one\n- point two\nFinal structured answer with detail beyond 200 chars to score well on structure heuristics."
        return "Draft answer with a list:\n- alpha\n- beta\nand enough length to look complete for the heuristic scorer."


async def main() -> None:
    # Tool check
    assert calculate("2 + 3 * 4")["result"] == 14
    assert calculate("sqrt(16)")["result"] == 4.0
    print("[ok] calculator")

    engine = ReasoningEngine(FakeRouter(), PromptCompiler())

    result = await engine.run("Explain X", "ollama:fake", ReasoningConfig(mode="deep"))
    assert result.final_answer
    assert result.plan and result.critique and result.verification
    assert result.metadata["verifier_confidence"] == 88
    steps = [s["step"] for s in result.trace]
    assert steps == ["classify", "plan", "solve", "critique", "repair", "verify", "finalize"], steps
    print(f"[ok] deep pipeline trace: {steps}")

    fast = await engine.run("Hi", "ollama:fake", ReasoningConfig(mode="fast"))
    assert [s["step"] for s in fast.trace] == ["classify", "solve"], fast.trace
    print("[ok] fast mode skips optional stages")

    report = await run_benchmark(engine, "ollama:fake", [{"prompt": "p", "keywords": ["alpha"]}], mode="deep")
    assert "keyword_uplift" in report["summary"]
    print(f"[ok] benchmark summary keys: {sorted(report['summary'].keys())}")

    print("\nALL SMOKE TESTS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
