/**
 * New Level Multi-Agentics — Shared domain model.
 *
 * This file is the single source of truth for the data structures exchanged
 * between the Express backend (engine, routes, MCP server) and the React
 * frontend. Keeping it framework-agnostic lets both sides import the exact
 * same contracts and stay in lock-step.
 */

// ---------------------------------------------------------------------------
// Primitive enums / unions
// ---------------------------------------------------------------------------

/** Lifecycle of a single orchestration run. */
export type RunStatus =
  | 'queued'
  | 'decomposing'
  | 'planning'
  | 'executing'
  | 'validating'
  | 'reviewing'
  | 'awaiting_approval'
  | 'shipping'
  | 'completed'
  | 'failed'
  | 'cancelled'

/** Lifecycle of a single task inside a run's DAG. */
export type TaskStatus =
  | 'pending' // dependencies not yet satisfied
  | 'ready' // dependencies satisfied, waiting for a worker
  | 'running' // assigned to an agent and executing
  | 'validating' // produced output, going through validator gates
  | 'blocked' // a validator/review gate rejected it; awaiting remediation
  | 'succeeded'
  | 'failed'
  | 'skipped'

/** Where in the hierarchy a node sits — mirrors the architecture diagram. */
export type StageKey =
  | 'goal'
  | 'orchestrator'
  | 'planner'
  | 'supervisors'
  | 'teams'
  | 'knowledge'
  | 'governance'
  | 'production'

/** Status shared by long-lived entities (agents, teams, MCP servers, tools). */
export type HealthStatus = 'idle' | 'active' | 'busy' | 'degraded' | 'offline' | 'error'

/** Severity used across logs, validators and policies. */
export type Severity = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical'

/** Outcome of a quality gate. */
export type GateOutcome = 'pass' | 'fail' | 'waived' | 'pending'

// ---------------------------------------------------------------------------
// Teams & Agents
// ---------------------------------------------------------------------------

/** A specialization domain — there are ten in the seeded platform. */
export type TeamKind =
  | 'backend'
  | 'frontend'
  | 'data'
  | 'devops'
  | 'security'
  | 'qa'
  | 'research'
  | 'design'
  | 'integration'
  | 'docs'

export interface Team {
  id: string
  kind: TeamKind
  name: string
  /** Short human description of what this team is responsible for. */
  mission: string
  /** Accent colour token used by the UI (hex). */
  accent: string
  supervisorId: string
  agentIds: string[]
  status: HealthStatus
  /** Rolling utilisation 0..1 for the observability dashboards. */
  utilization: number
  /** Number of tasks this team has completed across all runs. */
  completedTasks: number
}

/** The kind of work an individual agent performs. */
export type AgentRole =
  | 'supervisor'
  | 'architect'
  | 'implementer'
  | 'reviewer'
  | 'validator'
  | 'researcher'
  | 'integrator'
  | 'tester'
  | 'designer'
  | 'writer'
  | 'optimizer'
  | 'security'

export interface Agent {
  id: string
  teamId: string
  name: string
  role: AgentRole
  /** Free-form skill tags the scheduler matches tasks against. */
  skills: string[]
  /** Model the agent is wired to (display only in the simulator). */
  model: string
  status: HealthStatus
  /** Lifetime counters surfaced on the Agents page. */
  stats: AgentStats
  /** Currently assigned task id, if any. */
  currentTaskId: string | null
}

export interface AgentStats {
  tasksCompleted: number
  tasksFailed: number
  tokensUsed: number
  avgDurationMs: number
  successRate: number // 0..1
}

// ---------------------------------------------------------------------------
// Goal → Run → Task DAG
// ---------------------------------------------------------------------------

export interface Goal {
  id: string
  title: string
  description: string
  /** Free-form constraints the planner should respect. */
  constraints: string[]
  /** Target stack / languages requested by the user. */
  stack: string[]
  priority: TaskPriority
  createdAt: number
}

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'

export interface Task {
  id: string
  runId: string
  title: string
  description: string
  /** Which specialization should own this task. */
  teamKind: TeamKind
  /** Skills required — used by the scheduler to pick an agent. */
  requiredSkills: string[]
  /** Ids of tasks that must complete before this one becomes ready. */
  dependsOn: string[]
  status: TaskStatus
  priority: TaskPriority
  /** Estimated and actual cost in simulated "compute units". */
  estimateMs: number
  /** Assigned agent + timing, populated once it runs. */
  assignedAgentId: string | null
  startedAt: number | null
  finishedAt: number | null
  attempts: number
  /** Artifacts produced (file paths within the generated codebase). */
  artifacts: string[]
  /** Validator/review gate results attached to this task. */
  gates: QualityGate[]
  /** Layer of the DAG (0 = roots) for tidy graph layout. */
  depth: number
}

export interface Run {
  id: string
  goal: Goal
  status: RunStatus
  /** Which architecture stage is currently active (drives the live diagram). */
  activeStage: StageKey
  taskIds: string[]
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
  /** Aggregate progress 0..1 across the task DAG. */
  progress: number
  /** Rolled-up metrics for the run. */
  metrics: RunMetrics
  /** Whether a human approval is currently required before shipping. */
  requiresApproval: boolean
  approval: ApprovalDecision | null
  /** Versioned snapshots created when the run ships. */
  version: number
}

export interface RunMetrics {
  totalTasks: number
  succeeded: number
  failed: number
  linesOfCode: number
  filesGenerated: number
  tokensUsed: number
  estimatedCostUsd: number
  parallelPeak: number
  criticalPathMs: number
  wallClockMs: number
}

// ---------------------------------------------------------------------------
// Governance & Quality
// ---------------------------------------------------------------------------

export type GateKind =
  | 'schema'
  | 'lint'
  | 'security'
  | 'tests'
  | 'cost'
  | 'policy'
  | 'human_review'

export interface QualityGate {
  id: string
  kind: GateKind
  label: string
  outcome: GateOutcome
  /** Numeric score 0..100 when applicable. */
  score: number | null
  message: string
  evaluatedBy: string // agent id or 'human'
  evaluatedAt: number | null
}

export interface Policy {
  id: string
  name: string
  description: string
  /** What the policy guards (e.g. 'security', 'cost', 'compliance'). */
  category: string
  severity: Severity
  enabled: boolean
  /** A small DSL-ish rule string the governance engine evaluates. */
  rule: string
}

export interface ApprovalRequest {
  id: string
  runId: string
  taskId: string | null
  title: string
  summary: string
  /** What is being approved (ship, risky-tool, budget-overrun…). */
  reason: string
  severity: Severity
  createdAt: number
  status: 'open' | 'approved' | 'rejected'
  decidedBy: string | null
  decidedAt: number | null
  note: string | null
}

export interface ApprovalDecision {
  approved: boolean
  by: string
  at: number
  note: string
}

/** Role-based access-control entry shown on the Governance page. */
export interface RbacRole {
  id: string
  name: string
  description: string
  permissions: string[]
  memberCount: number
}

// ---------------------------------------------------------------------------
// Knowledge layer: Shared Memory, Vector DB, Codebase, Tools & APIs
// ---------------------------------------------------------------------------

export interface MemoryEntry {
  id: string
  runId: string | null
  key: string
  value: string
  scope: 'global' | 'run' | 'team'
  updatedAt: number
}

export interface VectorDoc {
  id: string
  title: string
  text: string
  /** Pre-computed lightweight embedding (see server/engine/embedding.ts). */
  embedding: number[]
  source: string
  tags: string[]
}

export interface VectorSearchHit {
  doc: Omit<VectorDoc, 'embedding'>
  score: number
}

export interface CodeArtifact {
  id: string
  runId: string
  path: string
  language: string
  lines: number
  bytes: number
  taskId: string | null
  preview: string
  createdAt: number
}

export type ToolCategory =
  | 'llm'
  | 'cloud'
  | 'database'
  | 'payments'
  | 'auth'
  | 'messaging'
  | 'devtools'
  | 'storage'
  | 'analytics'

export interface ToolDef {
  id: string
  name: string
  category: ToolCategory
  description: string
  /** Whether the platform can auto-register / auto-configure this provider. */
  autoConfigurable: boolean
  /** Required secret keys (names only — never real values). */
  requiredSecrets: string[]
  /** Connection status in the simulated registry. */
  status: 'unconfigured' | 'configuring' | 'connected' | 'error'
  docsUrl: string
}

// ---------------------------------------------------------------------------
// MCP servers
// ---------------------------------------------------------------------------

export interface McpToolInfo {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpServerInfo {
  id: string
  name: string
  transport: 'stdio' | 'http' | 'sse'
  status: HealthStatus
  toolCount: number
  tools: McpToolInfo[]
  description: string
}

// ---------------------------------------------------------------------------
// Production / deployments
// ---------------------------------------------------------------------------

export interface Deployment {
  id: string
  runId: string
  environment: 'preview' | 'staging' | 'production'
  status: 'pending' | 'building' | 'live' | 'rolled_back' | 'failed'
  url: string
  version: number
  createdAt: number
  linesOfCode: number
}

// ---------------------------------------------------------------------------
// Observability: logs / metrics / tracing
// ---------------------------------------------------------------------------

export interface LogEntry {
  id: string
  ts: number
  runId: string | null
  source: string // agent/team/engine component
  severity: Severity
  message: string
}

export interface MetricPoint {
  ts: number
  value: number
}

export interface MetricSeries {
  key: string
  label: string
  unit: string
  points: MetricPoint[]
}

export interface TraceSpan {
  id: string
  runId: string
  parentId: string | null
  name: string
  startTs: number
  endTs: number | null
  status: 'ok' | 'error' | 'running'
  attributes: Record<string, string | number>
}

// ---------------------------------------------------------------------------
// Live event stream (Server-Sent Events)
// ---------------------------------------------------------------------------

export type EngineEventType =
  | 'run.created'
  | 'run.updated'
  | 'run.stage'
  | 'run.completed'
  | 'task.created'
  | 'task.updated'
  | 'agent.updated'
  | 'log'
  | 'metric'
  | 'gate'
  | 'approval.requested'
  | 'approval.resolved'
  | 'deployment.updated'

export interface EngineEvent<T = unknown> {
  type: EngineEventType
  ts: number
  runId: string | null
  payload: T
}

// ---------------------------------------------------------------------------
// Aggregate snapshots used by dashboard endpoints
// ---------------------------------------------------------------------------

export interface PlatformSnapshot {
  runs: { active: number; completed: number; failed: number; total: number }
  agents: { total: number; active: number; idle: number }
  teams: number
  tools: { total: number; connected: number }
  mcpServers: number
  deployments: { total: number; live: number }
  totals: {
    linesOfCode: number
    filesGenerated: number
    tokensUsed: number
    tasksCompleted: number
  }
}
