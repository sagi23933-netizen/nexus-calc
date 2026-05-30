/**
 * MCP tool definitions.
 *
 * These operate directly on the live engine/state so an external MCP client
 * (Claude Desktop, an IDE, another agent) can drive the platform: submit goals,
 * inspect runs, search the knowledge base, approve tasks and read metrics.
 *
 * Each tool exposes a JSON-schema `inputSchema` (for discovery/listing) and a
 * `handler` returning a JSON-serialisable result. The stdio server in
 * `server.ts` adapts these into MCP responses; the REST `routes/mcp.ts` lists
 * them for the UI.
 */

import { store } from '../state'
import { makeGoal, startRun } from '../engine/orchestrator'
import { searchVectors } from '../engine/knowledgeService'
import { resolveApproval } from '../engine/reviewers'
import { resumeAfterApproval } from '../engine/orchestrator'
import { approvalsRepo } from '../db/repositories/approvalsRepo'
import { metrics } from '../observability/metrics'

export interface McpToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: Record<string, unknown>) => Promise<unknown> | unknown
}

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: 'submit_goal',
    description: 'Submit a product goal to the platform and start an autonomous build run. Returns the run id.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title for the goal' },
        description: { type: 'string', description: 'Full description of what to build' },
        stack: { type: 'array', items: { type: 'string' }, description: 'Desired languages/frameworks' },
        constraints: { type: 'array', items: { type: 'string' }, description: 'Constraints to respect' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] },
      },
      required: ['title', 'description'],
    },
    handler: (args) => {
      const goal = makeGoal({
        title: String(args.title),
        description: String(args.description),
        stack: (args.stack as string[]) ?? [],
        constraints: (args.constraints as string[]) ?? [],
        priority: (args.priority as 'low' | 'normal' | 'high' | 'critical') ?? 'normal',
      })
      const run = startRun(goal)
      return { runId: run.id, status: run.status, title: goal.title }
    },
  },
  {
    name: 'get_run',
    description: 'Get the status, metrics and task summary of a run by id.',
    inputSchema: {
      type: 'object',
      properties: { runId: { type: 'string' } },
      required: ['runId'],
    },
    handler: (args) => {
      const run = store.run(String(args.runId))
      if (!run) return { error: 'run not found' }
      const tasks = store.tasksOfRun(run.id)
      return {
        id: run.id,
        title: run.goal.title,
        status: run.status,
        activeStage: run.activeStage,
        progress: Number(run.progress.toFixed(2)),
        metrics: run.metrics,
        tasks: tasks.map((t) => ({ title: t.title, team: t.teamKind, status: t.status })),
      }
    },
  },
  {
    name: 'list_runs',
    description: 'List recent runs with their status and progress.',
    inputSchema: { type: 'object', properties: { limit: { type: 'number' } } },
    handler: (args) => {
      const limit = Math.min(50, Number(args.limit ?? 20) || 20)
      return {
        runs: store.runs().slice(0, limit).map((r) => ({ id: r.id, title: r.goal.title, status: r.status, progress: Number(r.progress.toFixed(2)) })),
      }
    },
  },
  {
    name: 'list_agents',
    description: 'List agents, optionally filtered by team kind. Returns names, roles and status.',
    inputSchema: {
      type: 'object',
      properties: { team: { type: 'string', description: 'Team kind, e.g. backend, frontend, security' } },
    },
    handler: (args) => {
      const team = args.team ? store.teamByKind(String(args.team)) : null
      const agents = team ? store.agentsOfTeam(team.id) : store.agents()
      return { total: agents.length, agents: agents.map((a) => ({ name: a.name, role: a.role, team: a.teamId, status: a.status, skills: a.skills })) }
    },
  },
  {
    name: 'search_knowledge',
    description: 'Semantic search over the platform vector knowledge base.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, k: { type: 'number' } },
      required: ['query'],
    },
    handler: (args) => {
      const hits = searchVectors(String(args.query), Number(args.k ?? 5))
      return { hits }
    },
  },
  {
    name: 'list_approvals',
    description: 'List pending human-approval requests in the governance queue.',
    inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['open', 'approved', 'rejected'] } } },
    handler: (args) => {
      const status = (args.status as 'open' | 'approved' | 'rejected') ?? 'open'
      return { approvals: approvalsRepo.list(status) }
    },
  },
  {
    name: 'approve_task',
    description: 'Approve or reject a pending approval request by id, resuming the run.',
    inputSchema: {
      type: 'object',
      properties: {
        approvalId: { type: 'string' },
        approved: { type: 'boolean' },
        by: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['approvalId', 'approved'],
    },
    handler: async (args) => {
      const id = String(args.approvalId)
      const req = approvalsRepo.get(id)
      if (!req) return { error: 'approval not found' }
      const by = String(args.by ?? 'mcp-client')
      const note = String(args.note ?? '')
      const updated = resolveApproval(id, Boolean(args.approved), by, note)
      const run = store.run(req.runId)
      if (run) await resumeAfterApproval(run, Boolean(args.approved), by, note)
      return { approval: updated }
    },
  },
  {
    name: 'get_metrics',
    description: 'Return platform metric series (parallelism, lines of code, tokens, …).',
    inputSchema: { type: 'object', properties: { key: { type: 'string' } } },
    handler: (args) => {
      if (args.key) return { series: metrics.get(String(args.key)) }
      return { series: metrics.all().map((s) => ({ key: s.key, label: s.label, unit: s.unit, latest: s.points.at(-1)?.value ?? 0 })) }
    },
  },
]

/** A lightweight descriptor used by the REST route + UI. */
export function mcpToolInfo() {
  return MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
}
