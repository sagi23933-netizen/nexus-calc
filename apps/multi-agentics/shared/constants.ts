/**
 * Platform-wide constants shared by client and server.
 */

import type { StageKey, TeamKind } from './types'

/** Default backend port (Express). */
export const DEFAULT_API_PORT = 4310

/** Brand metadata. */
export const BRAND = {
  product: 'New Level Multi-Agentics',
  vendor: 'GreenBook AI',
  tagline: 'Monster-Scale Multi-Agent System Architecture',
  subtitle:
    'Hierarchical orchestration for building extremely complex systems with up to 100 specialized agents',
} as const

/** Concurrency ceiling for the worker pool (parallel agent execution). */
export const MAX_PARALLEL_WORKERS = 12

/** Hard cap on how many tasks a single decomposition may produce. */
export const MAX_TASKS_PER_RUN = 120

/** Ordered architecture stages, top → bottom, matching the diagram. */
export const STAGE_ORDER: StageKey[] = [
  'goal',
  'orchestrator',
  'planner',
  'supervisors',
  'teams',
  'knowledge',
  'governance',
  'production',
]

export const STAGE_LABELS: Record<StageKey, string> = {
  goal: 'User / Product Goal',
  orchestrator: 'Master Orchestrator',
  planner: 'Task Decomposer + Planner',
  supervisors: 'Team Supervisors',
  teams: 'Agent Teams',
  knowledge: 'Shared Platform & Knowledge Layer',
  governance: 'Governance & Quality Layer',
  production: 'Production System',
}

/** Display order + labels for the ten teams. */
export const TEAM_ORDER: TeamKind[] = [
  'backend',
  'frontend',
  'data',
  'devops',
  'security',
  'qa',
  'research',
  'design',
  'integration',
  'docs',
]

export const TEAM_LABELS: Record<TeamKind, string> = {
  backend: 'Backend Team',
  frontend: 'Frontend Team',
  data: 'Data & ML Team',
  devops: 'DevOps & Platform Team',
  security: 'Security Team',
  qa: 'QA & Testing Team',
  research: 'Research Team',
  design: 'Design & UX Team',
  integration: 'Integration Team',
  docs: 'Docs & DevRel Team',
}

/** Accent colour per team (hex) used by diagram + cards. */
export const TEAM_ACCENTS: Record<TeamKind, string> = {
  backend: '#3b82f6',
  frontend: '#22d3ee',
  data: '#a855f7',
  devops: '#f59e0b',
  security: '#ef4444',
  qa: '#10b981',
  research: '#6366f1',
  design: '#ec4899',
  integration: '#14b8a6',
  docs: '#84cc16',
}

/** SSE channel path. */
export const SSE_PATH = '/sse/events'

/** Simulated per-token cost (USD) used for cost estimates. */
export const COST_PER_1K_TOKENS = 0.003

/** Average bytes per generated line, for size estimates. */
export const AVG_BYTES_PER_LINE = 34
