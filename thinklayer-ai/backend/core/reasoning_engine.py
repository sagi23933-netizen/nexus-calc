"""Reasoning engine — the orchestrator.

The local model never receives the user's question directly. Instead the engine
drives it through a structured pipeline:

    classify -> retrieve -> plan -> solve -> critique -> repair -> verify -> finalize

Each reasoning mode toggles which stages run, trading latency for depth.
"""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from typing import Any, Optional

from ..agents import Critic, Finalizer, Planner, Solver, Verifier
from .model_router import ModelRouter
from .prompt_compiler import PromptCompiler
from .task_classifier import TaskClassifier

# Which optional stages each mode enables.
MODE_PROFILES: dict[str, dict[str, bool]] = {
    "fast":     {"plan": False, "critique": False, "verify": False, "finalize": False},
    "deep":     {"plan": True,  "critique": True,  "verify": True,  "finalize": True},
    "research": {"plan": True,  "critique": True,  "verify": True,  "finalize": True},
    "coding":   {"plan": True,  "critique": True,  "verify": True,  "finalize": True},
    "math":     {"plan": True,  "critique": True,  "verify": True,  "finalize": True},
    "agent":    {"plan": True,  "critique": True,  "verify": True,  "finalize": True},
}


@dataclass
class ReasoningConfig:
    mode: str = "deep"
    max_passes: int = 2
    use_rag: bool = False
    use_tools: bool = True
    verify: bool = True
    temperature: float = 0.3

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> "ReasoningConfig":
        data = data or {}
        return cls(
            mode=data.get("mode", "deep"),
            max_passes=int(data.get("max_passes", 2)),
            use_rag=bool(data.get("use_rag", False)),
            use_tools=bool(data.get("use_tools", True)),
            verify=bool(data.get("verify", True)),
            temperature=float(data.get("temperature", 0.3)),
        )


@dataclass
class ReasoningResult:
    final_answer: str
    plan: Optional[str] = None
    draft: Optional[str] = None
    critique: Optional[str] = None
    verification: Optional[str] = None
    trace: list[dict] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


class ReasoningEngine:
    def __init__(self, router: ModelRouter, compiler: PromptCompiler, memory=None, tools=None) -> None:
        self.router = router
        self.compiler = compiler
        self.memory = memory
        self.tools = tools
        self.classifier = TaskClassifier(router, compiler)
        self.planner = Planner(router, compiler)
        self.solver = Solver(router, compiler)
        self.critic = Critic(router, compiler)
        self.verifier = Verifier(router, compiler)
        self.finalizer = Finalizer(router, compiler)

    async def run(self, user_prompt: str, model_id: str, config: ReasoningConfig) -> ReasoningResult:
        profile = MODE_PROFILES.get(config.mode, MODE_PROFILES["deep"])
        trace: list[dict] = []

        def step(name: str, detail: str, t0: float) -> None:
            trace.append({"step": name, "detail": detail, "ms": round((time.perf_counter() - t0) * 1000)})

        t0 = time.perf_counter()
        task_type = await self.classifier.classify(user_prompt, model_id)
        step("classify", f"task_type={task_type}", t0)

        context = ""
        if config.use_rag and self.memory is not None:
            t0 = time.perf_counter()
            chunks = await self.memory.retrieve(user_prompt)
            context = "\n\n".join(c["text"] for c in chunks)
            step("retrieve", f"{len(chunks)} chunks", t0)

        plan: Optional[str] = None
        if profile["plan"]:
            t0 = time.perf_counter()
            plan = await self.planner.run(user_prompt, context, model_id)
            step("plan", "plan created", t0)

        t0 = time.perf_counter()
        draft = await self.solver.run(user_prompt, plan or "", context, model_id, config.temperature)
        step("solve", f"{len(draft)} chars", t0)

        critique: Optional[str] = None
        repaired = draft
        if profile["critique"]:
            t0 = time.perf_counter()
            critique = await self.critic.run(user_prompt, draft, model_id)
            score = Critic.confidence(critique)
            step("critique", f"confidence={score}", t0)
            t0 = time.perf_counter()
            repaired = await self.critic.repair(user_prompt, draft, critique, model_id)
            step("repair", f"{len(repaired)} chars", t0)

        verification: Optional[str] = None
        if config.verify and profile["verify"]:
            t0 = time.perf_counter()
            verification = await self.verifier.run(user_prompt, repaired, model_id)
            step("verify", f"ready={Verifier.is_ready(verification)} confidence={Verifier.confidence(verification)}", t0)

        final_answer = repaired
        if profile["finalize"]:
            t0 = time.perf_counter()
            final_answer = await self.finalizer.run(user_prompt, repaired, verification or "", model_id)
            step("finalize", "polished", t0)

        return ReasoningResult(
            final_answer=final_answer,
            plan=plan,
            draft=draft,
            critique=critique,
            verification=verification,
            trace=trace,
            metadata={
                "task_type": task_type,
                "mode": config.mode,
                "model_id": model_id,
                "verifier_confidence": Verifier.confidence(verification) if verification else None,
                "critic_confidence": Critic.confidence(critique) if critique else None,
                "total_ms": sum(s["ms"] for s in trace),
            },
        )

    async def run_direct(self, user_prompt: str, model_id: str, temperature: float = 0.3) -> ReasoningResult:
        """Baseline: hand the raw prompt straight to the model. Used by benchmarks."""
        t0 = time.perf_counter()
        answer = await self.router.generate(model_id, user_prompt, {"temperature": temperature, "max_tokens": 2048})
        ms = round((time.perf_counter() - t0) * 1000)
        return ReasoningResult(
            final_answer=answer,
            trace=[{"step": "direct", "detail": "raw prompt -> model", "ms": ms}],
            metadata={"mode": "direct", "model_id": model_id, "total_ms": ms},
        )
