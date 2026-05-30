/**
 * Central runtime state for the platform.
 *
 * The catalog entities (teams, agents, tools, policies, RBAC roles, MCP server
 * descriptors) live here in memory as the authoritative source of truth for the
 * running process; runs/tasks/logs/etc. are additionally persisted through the
 * repositories. Everything funnels through this module so routes, the engine and
 * the MCP server all read/write one consistent picture.
 */

import { nanoid } from 'nanoid'
import { TEAM_TEMPLATES } from '@shared/agentRoles'
import { TOOL_CATALOG } from '@shared/toolCatalog'
import { TEAM_ACCENTS } from '@shared/constants'
import { embed } from './engine/embedding'
import type {
  Agent,
  CodeArtifact,
  McpServerInfo,
  MemoryEntry,
  Policy,
  RbacRole,
  Run,
  Task,
  Team,
  ToolDef,
  VectorDoc,
} from '@shared/types'

interface RuntimeState {
  teams: Map<string, Team>
  agents: Map<string, Agent>
  tools: Map<string, ToolDef>
  policies: Map<string, Policy>
  rbac: Map<string, RbacRole>
  mcpServers: Map<string, McpServerInfo>
  runs: Map<string, Run>
  tasks: Map<string, Task>
  memory: Map<string, MemoryEntry>
  vectors: Map<string, VectorDoc>
  artifacts: Map<string, CodeArtifact>
}

const state: RuntimeState = {
  teams: new Map(),
  agents: new Map(),
  tools: new Map(),
  policies: new Map(),
  rbac: new Map(),
  mcpServers: new Map(),
  runs: new Map(),
  tasks: new Map(),
  memory: new Map(),
  vectors: new Map(),
  artifacts: new Map(),
}

let initialized = false

// ---------------------------------------------------------------------------
// Initialisation / seeding
// ---------------------------------------------------------------------------

export function initState() {
  if (initialized) return
  seedTeamsAndAgents()
  seedTools()
  seedPolicies()
  seedRbac()
  seedKnowledge()
  initialized = true
}

function seedTeamsAndAgents() {
  for (const tpl of TEAM_TEMPLATES) {
    const teamId = `team_${tpl.kind}`
    const supervisor = makeAgent(teamId, tpl.supervisor)
    state.agents.set(supervisor.id, supervisor)
    const roster: Agent[] = tpl.roster.map((r) => {
      const ag = makeAgent(teamId, r)
      state.agents.set(ag.id, ag)
      return ag
    })
    const team: Team = {
      id: teamId,
      kind: tpl.kind,
      name: tpl.name,
      mission: tpl.mission,
      accent: TEAM_ACCENTS[tpl.kind],
      supervisorId: supervisor.id,
      agentIds: roster.map((r) => r.id),
      status: 'idle',
      utilization: 0,
      completedTasks: 0,
    }
    state.teams.set(team.id, team)
  }
}

function makeAgent(teamId: string, t: { name: string; role: Agent['role']; skills: string[]; model: string }): Agent {
  return {
    id: `agent_${nanoid(8)}`,
    teamId,
    name: t.name,
    role: t.role,
    skills: t.skills,
    model: t.model,
    status: 'idle',
    currentTaskId: null,
    stats: { tasksCompleted: 0, tasksFailed: 0, tokensUsed: 0, avgDurationMs: 0, successRate: 1 },
  }
}

function seedTools() {
  for (const t of TOOL_CATALOG) {
    state.tools.set(t.id, { ...t, status: t.status ?? 'unconfigured' })
  }
}

function seedPolicies() {
  const policies: Policy[] = [
    { id: 'pol_secrets', name: 'No hard-coded secrets', description: 'Block artifacts that embed credentials or API keys.', category: 'security', severity: 'critical', enabled: true, rule: 'artifact.content !~ /(api[_-]?key|secret|password)\\s*=/i' },
    { id: 'pol_cost', name: 'Per-run cost ceiling', description: 'Require approval if a run exceeds the budget threshold.', category: 'cost', severity: 'warning', enabled: true, rule: 'run.estimatedCostUsd <= 25' },
    { id: 'pol_tests', name: 'Tests required before ship', description: 'Production deploys require a passing test gate.', category: 'quality', severity: 'error', enabled: true, rule: 'run.gates.tests == "pass"' },
    { id: 'pol_review', name: 'Human review for critical', description: 'Critical-priority goals need a human approval gate.', category: 'compliance', severity: 'notice', enabled: true, rule: 'goal.priority != "critical" || approval.required' },
    { id: 'pol_license', name: 'License compliance', description: 'Dependencies must use approved licenses.', category: 'compliance', severity: 'warning', enabled: true, rule: 'dependency.license in APPROVED_LICENSES' },
    { id: 'pol_pii', name: 'PII handling', description: 'Flag artifacts that log personally identifiable information.', category: 'security', severity: 'error', enabled: true, rule: 'artifact.content !~ /console\\.log\\(.*(email|ssn|phone)/i' },
  ]
  for (const p of policies) state.policies.set(p.id, p)
}

function seedRbac() {
  const roles: RbacRole[] = [
    { id: 'role_owner', name: 'Owner', description: 'Full control over the platform, runs and governance.', permissions: ['*'], memberCount: 1 },
    { id: 'role_operator', name: 'Operator', description: 'Start/cancel runs and approve standard gates.', permissions: ['run.create', 'run.cancel', 'approval.decide'], memberCount: 3 },
    { id: 'role_reviewer', name: 'Reviewer', description: 'Review and approve quality gates, read-only on infra.', permissions: ['approval.decide', 'run.read', 'governance.read'], memberCount: 5 },
    { id: 'role_viewer', name: 'Viewer', description: 'Read-only access to dashboards and runs.', permissions: ['run.read', 'governance.read', 'observability.read'], memberCount: 12 },
  ]
  for (const r of roles) state.rbac.set(r.id, r)
}

function seedKnowledge() {
  const docs: Array<Omit<VectorDoc, 'embedding'>> = [
    { id: 'kb_orchestration', title: 'Hierarchical orchestration', text: 'A master orchestrator decomposes a goal into a task DAG and dispatches subtasks to specialized agent teams supervised independently for scalable parallelism.', source: 'platform/handbook', tags: ['orchestration', 'architecture'] },
    { id: 'kb_dag', title: 'Task DAG scheduling', text: 'Tasks form a directed acyclic graph. A topological order plus a priority queue and bounded worker pool yields maximum safe parallelism without bottlenecks.', source: 'platform/handbook', tags: ['scheduling', 'dag', 'parallelism'] },
    { id: 'kb_validation', title: 'Validation gates', text: 'Validator agents run schema, lint, security, test and cost gates. Failures block a task and route it back for remediation before it can ship.', source: 'platform/handbook', tags: ['governance', 'quality'] },
    { id: 'kb_hitl', title: 'Human in the loop', text: 'Critical or high-risk steps pause for a human approval decision. Reviewers approve or reject from the governance queue before production ships.', source: 'platform/handbook', tags: ['governance', 'approval'] },
    { id: 'kb_rag', title: 'Retrieval augmented generation', text: 'Agents query the vector database and shared memory for context before acting, grounding generated code in prior decisions and documentation.', source: 'platform/handbook', tags: ['knowledge', 'rag', 'memory'] },
    { id: 'kb_tools', title: 'Tools and API auto-configuration', text: 'The integration team can auto-register external providers and insert API secrets through guided provisioning flows so users never get stuck on setup.', source: 'platform/handbook', tags: ['tools', 'integration', 'automation'] },
    { id: 'kb_observability', title: 'Observability', text: 'Every run emits structured logs, time-series metrics and trace spans, streamed live over server-sent events for full visibility into agent activity.', source: 'platform/handbook', tags: ['observability', 'telemetry'] },
    { id: 'kb_mcp', title: 'Model Context Protocol servers', text: 'The platform exposes its engine through an MCP server so external agents and IDEs can submit goals, inspect runs and approve tasks programmatically.', source: 'platform/handbook', tags: ['mcp', 'integration'] },
  ]
  for (const d of docs) {
    const doc: VectorDoc = { ...d, embedding: embed(`${d.title}. ${d.text}`) }
    state.vectors.set(doc.id, doc)
  }

  const memos: Array<Omit<MemoryEntry, 'id' | 'updatedAt'>> = [
    { runId: null, key: 'platform.name', value: 'New Level Multi-Agentics', scope: 'global' },
    { runId: null, key: 'platform.vendor', value: 'GreenBook AI', scope: 'global' },
    { runId: null, key: 'defaults.max_parallel_workers', value: '12', scope: 'global' },
    { runId: null, key: 'defaults.review_threshold', value: '0.85', scope: 'global' },
  ]
  for (const m of memos) {
    const entry: MemoryEntry = { ...m, id: `mem_${nanoid(8)}`, updatedAt: Date.now() }
    state.memory.set(entry.id, entry)
  }
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

export const store = {
  // Teams & agents
  teams: () => [...state.teams.values()],
  team: (id: string) => state.teams.get(id) ?? null,
  teamByKind: (kind: string) => [...state.teams.values()].find((t) => t.kind === kind) ?? null,
  agents: () => [...state.agents.values()],
  agent: (id: string) => state.agents.get(id) ?? null,
  agentsOfTeam: (teamId: string) => [...state.agents.values()].filter((a) => a.teamId === teamId),
  setAgent: (a: Agent) => state.agents.set(a.id, a),
  setTeam: (t: Team) => state.teams.set(t.id, t),

  // Tools
  tools: () => [...state.tools.values()],
  tool: (id: string) => state.tools.get(id) ?? null,
  setTool: (t: ToolDef) => state.tools.set(t.id, t),

  // Governance
  policies: () => [...state.policies.values()],
  policy: (id: string) => state.policies.get(id) ?? null,
  setPolicy: (p: Policy) => state.policies.set(p.id, p),
  rbacRoles: () => [...state.rbac.values()],

  // MCP
  mcpServers: () => [...state.mcpServers.values()],
  setMcpServer: (s: McpServerInfo) => state.mcpServers.set(s.id, s),

  // Runs & tasks
  runs: () => [...state.runs.values()].sort((a, b) => b.createdAt - a.createdAt),
  run: (id: string) => state.runs.get(id) ?? null,
  setRun: (r: Run) => state.runs.set(r.id, r),
  activeRuns: () => [...state.runs.values()].filter((r) => !['completed', 'failed', 'cancelled'].includes(r.status)),
  task: (id: string) => state.tasks.get(id) ?? null,
  setTask: (t: Task) => state.tasks.set(t.id, t),
  tasksOfRun: (runId: string) => [...state.tasks.values()].filter((t) => t.runId === runId),

  // Knowledge
  memory: () => [...state.memory.values()].sort((a, b) => b.updatedAt - a.updatedAt),
  setMemory: (m: MemoryEntry) => state.memory.set(m.id, m),
  vectors: () => [...state.vectors.values()],
  setVector: (v: VectorDoc) => state.vectors.set(v.id, v),
  artifacts: () => [...state.artifacts.values()],
  artifactsOfRun: (runId: string) => [...state.artifacts.values()].filter((a) => a.runId === runId),
  setArtifact: (a: CodeArtifact) => state.artifacts.set(a.id, a),
}
