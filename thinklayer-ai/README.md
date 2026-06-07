# ThinkLayer AI

**A cognitive runtime for local AI models.**

ThinkLayer AI is a local-first desktop platform that connects to local LLMs
(Ollama, llama.cpp, LM Studio) and adds a structured reasoning layer on top of
them: planning, tools, memory, retrieval, critique and verification.

> ThinkLayer AI adds advanced reasoning workflows to local AI models, turning
> them into structured problem-solving agents.

The key idea: **the local model never receives the user's question directly.**
It receives small, structured tasks that the orchestrator generates for it —
plan, solve, critique, repair, verify, finalize. The product is
**evaluation-driven**: a built-in benchmark proves that the reasoning layer
beats a direct model call on structured tasks, instead of just *feeling*
smarter.

---

## Architecture

```
User
 ↓
Desktop App (Tauri + React)
 ↓  HTTP
Local API Server (FastAPI)
 ↓
Reasoning Orchestrator
 ↓
Classify → Retrieve → Plan → Solve → Critique → Repair → Verify → Finalize
 ↓
Model Router
 ↓
Ollama / llama.cpp / LM Studio
```

## Repository layout

```
thinklayer-ai/
├── backend/              FastAPI + reasoning engine (the heart)
│   ├── main.py           App entry point + /api/health
│   ├── api/              REST routes: chat, models, files, evals
│   ├── core/             reasoning_engine, model_router, prompt_compiler, task_classifier, config
│   ├── agents/           planner, solver, critic, verifier, finalizer
│   ├── providers/        ollama + openai-compatible (LM Studio / llama.cpp)
│   ├── tools/            calculator, python_runner, file_reader, registry
│   ├── memory/           sqlite_store, vector_store, embeddings, rag
│   ├── evals/            benchmark_runner, scoring, test_sets/
│   └── prompts/          role-specific prompt templates (*.md)
├── apps/desktop/         Tauri + React + TypeScript UI
├── model_configs/        provider endpoint configs
└── data/                 runtime SQLite, vectors, uploads (gitignored)
```

## Quickstart

### 1. Backend

```bash
cd thinklayer-ai
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

Open <http://localhost:8000/docs> for the interactive API, or check
<http://localhost:8000/api/health>.

No model server? The pipeline wiring is verified offline with:

```bash
python -m backend.smoke_test
```

### 2. A local model (example: Ollama)

```bash
ollama serve
ollama pull llama3.2
```

Models are addressed by a provider prefix: `ollama:llama3.2`,
`lmstudio:qwen2.5-7b-instruct`, `llamacpp:phi-3-mini`.

### 3. Desktop app

```bash
cd apps/desktop
npm install
npm run dev          # browser UI at http://localhost:1420
npm run tauri dev    # native desktop window (requires the Rust toolchain)
```

## Reasoning modes

| Mode       | Plan | Critique+Repair | Verify | Finalize | Use for |
|------------|:----:|:---------------:|:------:|:--------:|---------|
| `fast`     |      |                 |        |          | quick single-pass answers |
| `deep`     |  ✓   |        ✓        |   ✓    |    ✓     | general structured tasks |
| `research` |  ✓   |        ✓        |   ✓    |    ✓     | RAG + sources |
| `coding`   |  ✓   |        ✓        |   ✓    |    ✓     | code generation + review |
| `math`     |  ✓   |        ✓        |   ✓    |    ✓     | step-by-step + tools |
| `agent`    |  ✓   |        ✓        |   ✓    |    ✓     | longer tool workflows |

## Prove the value — benchmark

```bash
curl -X POST http://localhost:8000/api/evals/run \
  -H 'Content-Type: application/json' \
  -d '{"model_id": "ollama:llama3.2", "mode": "deep", "test_set": "starter"}'
```

Each case runs the **same model twice** — once direct, once through the
pipeline — and reports `keyword_uplift`, `structure_uplift` and
`latency_cost_x`. If the layer is not winning, the numbers say so.

## Example: chat

```bash
curl -X POST http://localhost:8000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Plan a weekend trip to Rome", "model_id": "ollama:llama3.2", "mode": "deep"}'
```

The response includes `final_answer` plus the full `trace` (each stage + timing)
and `plan` / `critique` / `verification` so the UI can show the operational
reasoning workflow.

## MVP status (v1)

Implemented:
- ✅ FastAPI backend + Planner → Solver → Critic → Verifier → Finalizer pipeline
- ✅ Model router over Ollama / LM Studio / llama.cpp
- ✅ Prompt compiler + role-specific templates
- ✅ Reasoning modes (fast / deep / research / coding / math / agent)
- ✅ SQLite conversation history
- ✅ Basic RAG (chunk → embed → store → retrieve) with file upload
- ✅ Tools: calculator, python_runner, file_reader (controlled registry)
- ✅ Benchmark: Direct vs Deep with quality + latency metrics
- ✅ Tauri + React desktop skeleton with reasoning-trace panel

Next (see the design doc that seeded this scaffold):
- Structured tool-calling from inside the pipeline
- Swap the dev vector store for Chroma / LanceDB
- Per-role model assignment (small classifier, stronger solver)
- Benchmark dashboard UI + model leaderboard
- Agent builder & reusable workflows

## Splitting into its own repo

This project lives self-contained under `thinklayer-ai/`. To extract it into a
standalone repository while keeping history:

```bash
git subtree split -P thinklayer-ai -b thinklayer-main
# then push that branch to a new empty repo
```
