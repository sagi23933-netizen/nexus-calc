"""Benchmark runner.

For each test case, run the SAME model twice:
  1. Direct  — raw prompt straight to the model.
  2. Deep    — through the full reasoning pipeline.

Then compare quality proxies and latency. This is the product's central claim:
the reasoning layer should measurably beat a direct call on structured tasks.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

from ..core.reasoning_engine import ReasoningConfig, ReasoningEngine
from .scoring import keyword_score, structure_score


@dataclass
class CaseResult:
    prompt: str
    direct_answer: str
    deep_answer: str
    direct_ms: int
    deep_ms: int
    direct_keyword: float
    deep_keyword: float
    direct_structure: float
    deep_structure: float
    deep_verifier_confidence: int | None


async def run_benchmark(engine: ReasoningEngine, model_id: str, cases: list[dict], mode: str = "deep") -> dict:
    results: list[CaseResult] = []
    for case in cases:
        prompt = case["prompt"]
        expected = case.get("keywords", [])

        direct = await engine.run_direct(prompt, model_id)
        deep = await engine.run(prompt, model_id, ReasoningConfig(mode=mode))

        results.append(
            CaseResult(
                prompt=prompt,
                direct_answer=direct.final_answer,
                deep_answer=deep.final_answer,
                direct_ms=direct.metadata.get("total_ms", 0),
                deep_ms=deep.metadata.get("total_ms", 0),
                direct_keyword=keyword_score(direct.final_answer, expected),
                deep_keyword=keyword_score(deep.final_answer, expected),
                direct_structure=structure_score(direct.final_answer),
                deep_structure=structure_score(deep.final_answer),
                deep_verifier_confidence=deep.metadata.get("verifier_confidence"),
            )
        )

    n = len(results) or 1
    summary = {
        "model_id": model_id,
        "mode": mode,
        "cases": n,
        "avg_direct_keyword": sum(r.direct_keyword for r in results) / n,
        "avg_deep_keyword": sum(r.deep_keyword for r in results) / n,
        "avg_direct_structure": sum(r.direct_structure for r in results) / n,
        "avg_deep_structure": sum(r.deep_structure for r in results) / n,
        "avg_direct_ms": sum(r.direct_ms for r in results) / n,
        "avg_deep_ms": sum(r.deep_ms for r in results) / n,
    }
    summary["keyword_uplift"] = summary["avg_deep_keyword"] - summary["avg_direct_keyword"]
    summary["structure_uplift"] = summary["avg_deep_structure"] - summary["avg_direct_structure"]
    summary["latency_cost_x"] = (
        summary["avg_deep_ms"] / summary["avg_direct_ms"] if summary["avg_direct_ms"] else None
    )

    return {"summary": summary, "results": [asdict(r) for r in results]}
