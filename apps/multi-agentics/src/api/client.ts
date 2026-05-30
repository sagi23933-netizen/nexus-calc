/**
 * Typed REST client for the platform API.
 * All calls go through the Vite proxy to the Express backend.
 */

import type {
  Agent,
  ApprovalRequest,
  CodeArtifact,
  Deployment,
  LogEntry,
  McpServerInfo,
  McpToolInfo,
  MemoryEntry,
  MetricSeries,
  PlatformSnapshot,
  Policy,
  RbacRole,
  Run,
  Task,
  Team,
  ToolDef,
  TraceSpan,
  VectorSearchHit,
} from '@shared/types'

const BASE = '/api'

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export type TeamWithRoster = Team & { supervisor: Agent | null; agents: Agent[] }

export const api = {
  // Snapshot
  snapshot: () => http<{ snapshot: PlatformSnapshot }>('/snapshot').then((r) => r.snapshot),

  // Runs
  submitGoal: (goal: { title: string; description: string; stack?: string[]; constraints?: string[]; priority?: string }) =>
    http<{ runId: string; run: Run }>('/runs', { method: 'POST', body: JSON.stringify(goal) }),
  listRuns: () => http<{ runs: Run[] }>('/runs').then((r) => r.runs),
  getRun: (id: string) => http<{ run: Run }>(`/runs/${id}`).then((r) => r.run),
  getTasks: (id: string) => http<{ tasks: Task[] }>(`/runs/${id}/tasks`).then((r) => r.tasks),
  getArtifacts: (id: string) => http<{ artifacts: CodeArtifact[] }>(`/runs/${id}/artifacts`).then((r) => r.artifacts),
  cancelRun: (id: string) => http<{ run: Run }>(`/runs/${id}/cancel`, { method: 'POST' }).then((r) => r.run),

  // Teams & agents
  listTeams: () => http<{ teams: TeamWithRoster[] }>('/teams').then((r) => r.teams),
  getTeam: (id: string) => http<{ team: TeamWithRoster }>(`/teams/${id}`).then((r) => r.team),
  listAgents: (team?: string) => http<{ agents: Agent[]; total: number }>(`/agents${team ? `?team=${team}` : ''}`),

  // Knowledge
  memory: (scope?: string) => http<{ entries: MemoryEntry[] }>(`/knowledge/memory${scope ? `?scope=${scope}` : ''}`).then((r) => r.entries),
  vectors: () => http<{ docs: Array<Omit<import('@shared/types').VectorDoc, 'embedding'>>; dim: number }>('/knowledge/vectors'),
  search: (query: string, k = 5) => http<{ hits: VectorSearchHit[] }>('/knowledge/search', { method: 'POST', body: JSON.stringify({ query, k }) }).then((r) => r.hits),
  artifacts: (runId?: string) => http<{ artifacts: CodeArtifact[] }>(`/knowledge/artifacts${runId ? `?run=${runId}` : ''}`).then((r) => r.artifacts),

  // Governance
  policies: () => http<{ policies: Policy[] }>('/governance/policies').then((r) => r.policies),
  togglePolicy: (id: string, enabled: boolean) => http<{ policy: Policy }>(`/governance/policies/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }).then((r) => r.policy),
  rbac: () => http<{ roles: RbacRole[] }>('/governance/rbac').then((r) => r.roles),
  approvals: (status?: string) => http<{ approvals: ApprovalRequest[] }>(`/governance/approvals${status ? `?status=${status}` : ''}`).then((r) => r.approvals),
  decideApproval: (id: string, approved: boolean, by: string, note: string) =>
    http<{ approval: ApprovalRequest; run: Run | null }>(`/governance/approvals/${id}/decide`, { method: 'POST', body: JSON.stringify({ approved, by, note }) }),

  // Observability
  logs: (params: { run?: string; severity?: string; limit?: number } = {}) => {
    const q = new URLSearchParams()
    if (params.run) q.set('run', params.run)
    if (params.severity) q.set('severity', params.severity)
    if (params.limit) q.set('limit', String(params.limit))
    return http<{ logs: LogEntry[] }>(`/observability/logs?${q.toString()}`).then((r) => r.logs)
  },
  metrics: () => http<{ series: MetricSeries[] }>('/observability/metrics').then((r) => r.series),
  traces: (runId: string) => http<{ spans: TraceSpan[] }>(`/observability/traces/${runId}`).then((r) => r.spans),

  // Tools
  tools: (category?: string) => http<{ tools: ToolDef[]; summary: { total: number; connected: number } }>(`/tools${category ? `?category=${category}` : ''}`),
  configureTool: (id: string) => http<{ steps: unknown[]; tool: ToolDef }>(`/tools/${id}/configure`, { method: 'POST' }),
  toolProgress: (id: string) => http<{ steps: Array<{ label: string; status: string; detail: string }> | null; tool: ToolDef }>(`/tools/${id}/progress`),
  disconnectTool: (id: string) => http<{ tool: ToolDef }>(`/tools/${id}/disconnect`, { method: 'POST' }).then((r) => r.tool),

  // Production
  deployments: () => http<{ deployments: Deployment[] }>('/production/deployments').then((r) => r.deployments),

  // MCP
  mcpServers: () => http<{ servers: McpServerInfo[] }>('/mcp/servers').then((r) => r.servers),
  mcpTools: () => http<{ tools: McpToolInfo[] }>('/mcp/tools').then((r) => r.tools),
}
