/**
 * Master Orchestrator — the top of the hierarchy.
 *
 * Owns the run lifecycle state machine that mirrors the architecture diagram,
 * top to bottom:
 *   goal → orchestrator → planner(decompose) → supervisors/teams(execute) →
 *   knowledge(validate) → governance(review + approval) → production(ship).
 *
 * Each transition emits a `run.stage` event so the live diagram lights up the
 * active layer. Human-approval gates pause the machine; `resumeAfterApproval`
 * continues it once a decision arrives.
 */

import { nanoid } from 'nanoid'
import { store } from '../state'
import { bus } from './eventBus'
import { logger } from '../observability/logger'
import { metrics } from '../observability/metrics'
import { tracing } from '../observability/tracing'
import { decompose } from './decomposer'
import { executeRun } from './scheduler'
import { reviewRun, requestApproval } from './reviewers'
import { evaluatePolicies, isBlocking } from './governance'
import { remember } from './knowledgeService'
import { runsRepo, tasksRepo } from '../db/repositories/runsRepo'
import { deploymentsRepo } from '../db/repositories/deploymentsRepo'
import { STAGE_LABELS } from '@shared/constants'
import type { Deployment, Goal, Run, StageKey } from '@shared/types'

/** Create a Goal record from raw user input. */
export function makeGoal(input: Partial<Goal> & { title: string; description: string }): Goal {
  return {
    id: `goal_${nanoid(8)}`,
    title: input.title,
    description: input.description,
    constraints: input.constraints ?? [],
    stack: input.stack ?? [],
    priority: input.priority ?? 'normal',
    createdAt: Date.now(),
  }
}

/** Create and immediately start a run for a goal. Returns the run synchronously. */
export function startRun(goal: Goal): Run {
  const run: Run = {
    id: `run_${nanoid(8)}`,
    goal,
    status: 'queued',
    activeStage: 'goal',
    taskIds: [],
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    progress: 0,
    requiresApproval: false,
    approval: null,
    version: 0,
    metrics: {
      totalTasks: 0,
      succeeded: 0,
      failed: 0,
      linesOfCode: 0,
      filesGenerated: 0,
      tokensUsed: 0,
      estimatedCostUsd: 0,
      parallelPeak: 0,
      criticalPathMs: 0,
      wallClockMs: 0,
    },
  }
  store.setRun(run)
  persist(run)
  bus.emit('run.created', run, run.id)
  logger.info('orchestrator', `New run accepted: "${goal.title}" [${goal.priority}]`, run.id)
  metrics.increment('runs', 'Runs started', 'runs')

  // Drive the pipeline asynchronously; callers get the run id immediately.
  void drive(run).catch((err) => {
    logger.error('orchestrator', `Run ${run.id} crashed: ${String(err)}`, run.id)
    transition(run, 'failed', 'production')
  })
  return run
}

/** The full pipeline, stage by stage. */
async function drive(run: Run) {
  run.startedAt = Date.now()
  const rootSpan = tracing.start(run.id, `run:${run.goal.title}`)

  // Stage: orchestrator analyses the goal.
  transition(run, 'decomposing', 'orchestrator')
  await tick(300)
  remember('goal.title', run.goal.title, 'run', run.id)

  // Stage: planner decomposes into a task DAG.
  transition(run, 'planning', 'planner')
  const tasks = decompose(run.id, run.goal)
  for (const t of tasks) store.setTask(t)
  run.taskIds = tasks.map((t) => t.id)
  run.metrics.totalTasks = tasks.length
  tasksRepo.upsertMany(tasks)
  for (const t of tasks) bus.emit('task.created', t, run.id)
  logger.info('planner', `Decomposed goal into ${tasks.length} tasks across ${new Set(tasks.map((t) => t.teamKind)).size} teams`, run.id)
  persist(run)
  await tick(300)

  // Stage: supervisors dispatch teams; scheduler executes the DAG in parallel.
  transition(run, 'executing', 'teams')
  const schedResult = await executeRun(run)
  logger.info('orchestrator', `Execution complete: ${schedResult.succeeded} succeeded, ${schedResult.failed} failed, peak parallelism ${schedResult.parallelPeak}`, run.id)

  // Stage: knowledge/quality validation already attached per-task; aggregate now.
  transition(run, 'validating', 'knowledge')
  await tick(250)

  // Stage: governance review + policy evaluation.
  transition(run, 'reviewing', 'governance')
  const review = reviewRun(run)
  const violations = evaluatePolicies(run)
  const hardViolations = violations.filter(isBlocking)
  remember('review.score', String(review.score), 'run', run.id)

  const needsApproval = review.requiresHumanApproval || hardViolations.length > 0
  if (needsApproval) {
    run.requiresApproval = true
    const reason = [
      review.requiresHumanApproval ? 'reviewer flagged the build' : '',
      hardViolations.length ? `policy: ${hardViolations.map((v) => v.name).join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('; ')
    requestApproval(run, review.summary, reason, hardViolations.length ? 'error' : 'notice')
    transition(run, 'awaiting_approval', 'governance')
    persist(run)
    tracing.end(rootSpan, 'ok', { stage: 'awaiting_approval' })
    // Machine pauses here; resumeAfterApproval() continues it.
    return
  }

  await ship(run)
  tracing.end(rootSpan, 'ok')
}

/** Continue the pipeline after a human approves; or fail it on rejection. */
export async function resumeAfterApproval(run: Run, approved: boolean, by: string, note: string) {
  run.approval = { approved, by, at: Date.now(), note }
  run.requiresApproval = false
  if (!approved) {
    logger.warn('orchestrator', `Run ${run.id} rejected by ${by}: ${note}`, run.id)
    transition(run, 'failed', 'governance')
    persist(run)
    return
  }
  logger.info('orchestrator', `Run ${run.id} approved by ${by} — shipping`, run.id)
  await ship(run)
}

/** Final stage: produce a versioned deployment. */
async function ship(run: Run) {
  transition(run, 'shipping', 'production')
  await tick(400)
  run.version += 1

  const deployment: Deployment = {
    id: `dep_${nanoid(8)}`,
    runId: run.id,
    environment: 'production',
    status: 'live',
    url: `https://${slug(run.goal.title)}-${run.version}.greenbook.app`,
    version: run.version,
    createdAt: Date.now(),
    linesOfCode: run.metrics.linesOfCode,
  }
  deploymentsRepo.upsert(deployment)
  bus.emit('deployment.updated', deployment, run.id)

  run.finishedAt = Date.now()
  run.metrics.wallClockMs = run.finishedAt - (run.startedAt ?? run.finishedAt)
  transition(run, 'completed', 'production')
  bus.emit('run.completed', run, run.id)
  metrics.increment('runs_done', 'Runs completed', 'runs')
  logger.info('orchestrator', `Run ${run.id} shipped v${run.version}: ${run.metrics.linesOfCode.toLocaleString()} LoC, ${run.metrics.filesGenerated} files at ${deployment.url}`, run.id)
  persist(run)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function transition(run: Run, status: Run['status'], stage: StageKey) {
  run.status = status
  run.activeStage = stage
  store.setRun(run)
  bus.emit('run.stage', { runId: run.id, status, stage, label: STAGE_LABELS[stage] }, run.id)
  bus.emit('run.updated', run, run.id)
}

function persist(run: Run) {
  try {
    runsRepo.upsert(run)
  } catch {
    /* best effort */
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 32) || 'app'
}

function tick(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Cancel an in-flight run. */
export function cancelRun(run: Run) {
  if (['completed', 'failed', 'cancelled'].includes(run.status)) return
  transition(run, 'cancelled', run.activeStage)
  run.finishedAt = Date.now()
  persist(run)
  logger.warn('orchestrator', `Run ${run.id} cancelled`, run.id)
}
