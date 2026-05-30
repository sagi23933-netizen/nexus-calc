# New Level Multi-Agentics — by GreenBook AI

> **Monster-Scale Multi-Agent System Architecture**
> Hierarchical orchestration for building extremely complex systems with up to 100 specialized agents.

A full-stack web application that turns a **product goal** into a finished, shipped
build by orchestrating a hierarchy of autonomous agent teams — exactly the architecture
in the reference diagram, made interactive and live.

A Master Orchestrator decomposes the goal into a **task DAG**, Team Supervisors dispatch
work to **10 specialized teams (10–20 agents each)**, everything is grounded by a
**shared knowledge layer** (memory + vector DB + codebase + tools), gated by a
**governance & quality layer** (validators, reviewers, human-in-the-loop), and shipped
to **production** — all observable in real time.

---

## ✨ What's inside

| Layer | Implementation |
|---|---|
| **Master Orchestrator** | Run lifecycle state machine (`server/engine/orchestrator.ts`) |
| **Task Decomposer + Planner** | Goal → task DAG with critical-path analysis (`decomposer.ts`, `dag.ts`) |
| **Scheduler** | Topological + priority scheduling on a bounded **worker pool** with backpressure (`scheduler.ts`, `workerPool.ts`) — true parallelism, no bottlenecks |
| **Agent teams** | 10 teams, 116 seeded agents with roles/skills/stats (`shared/agentRoles.ts`) |
| **Knowledge layer** | Shared memory + dependency-free **vector DB** with cosine search (`embedding.ts`, `knowledgeService.ts`) |
| **Governance & quality** | Validator gates, reviewer scoring, **human-approval queue**, policy engine, RBAC (`validators.ts`, `reviewers.ts`, `governance.ts`) |
| **Tools & APIs** | 36-provider registry with simulated **auto-registration / API-key provisioning** (`toolsService.ts`) |
| **Observability** | Structured logs, time-series metrics, trace spans — streamed over **SSE** |
| **MCP server** | Real stdio **Model Context Protocol** server exposing the engine (`server/mcp/`) |
| **Production** | Versioned deployments per shipped run |

Built on the same proven stack as the rest of the repo: **Vite + React 19 + TypeScript +
Tailwind + Express + better-sqlite3**.

---

## 🚀 Quick start

```bash
cd apps/multi-agentics
npm install
npm run dev        # Express API on :4310 + Vite UI on :5310
```

Open **http://localhost:5310**, go to **Mission Control**, describe a goal, and hit
**Launch autonomous build** — watch the architecture diagram light up stage by stage as
agents work in parallel, gates evaluate, and the build ships to Production.

Optional: seed a demo build and persist the knowledge base:

```bash
npm run seed
```

---

## 🧩 MCP server

Expose the orchestration engine over the Model Context Protocol:

```bash
npm run mcp
```

Register it with an MCP client (e.g. Claude Desktop) via `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "new-level-multi-agentics": {
      "command": "npx",
      "args": ["tsx", "server/mcp/server.ts"],
      "cwd": "apps/multi-agentics"
    }
  }
}
```

**Tools:** `submit_goal`, `get_run`, `list_runs`, `list_agents`, `search_knowledge`,
`list_approvals`, `approve_task`, `get_metrics`.

---

## 🏗️ Architecture & efficiency

- **Task DAG** (`dag.ts`) — Kahn topological sort, cycle detection, longest-path
  (critical path) so the chain that bounds wall-clock time gets priority.
- **Worker pool** (`workerPool.ts`) — bounded concurrency + priority queue +
  backpressure; records the true parallel peak.
- **Event bus** (`eventBus.ts`) — decoupled pub/sub; a slow consumer can never block a
  producer (the "no bottlenecks" guarantee).
- **SSE streaming** — the server pushes deltas; the UI never polls.
- **LLM adapter seam** (`llmAdapter.ts`) — ships with a deterministic simulator; drop in
  a real provider with `setLlmProvider(...)` and nothing else changes.

---

## 📦 Build & export

```bash
npm run build      # typecheck + production bundle (dist/web), served by Express in prod
npm run zip        # → new-level-multi-agentics.zip (full source, no node_modules)
```

---

## 🗂️ Project layout

```
apps/multi-agentics/
├── shared/      # domain model shared by client + server (single source of truth)
├── server/      # Express API, the orchestration engine, observability, MCP server
│   ├── engine/  # orchestrator, decomposer, scheduler, dag, workerPool, validators…
│   ├── db/      # SQLite schema + repositories
│   ├── routes/  # REST controllers + SSE
│   └── mcp/     # stdio MCP server
└── src/         # React frontend (AppShell, interactive diagram, one page per layer)
```

---

## ⚖️ Honest scope

The orchestration engine runs as a **fully-functional simulation** — no external API
keys are required and nothing real is provisioned. The auto-registration / API-key flows
model the orchestration that *would* drive a real provider, with clear simulated
outcomes. This is a complete, working foundation designed to grow toward the larger
autonomous vision.

© GreenBook AI · MIT License
