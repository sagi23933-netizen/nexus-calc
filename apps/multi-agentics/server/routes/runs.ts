/**
 * Run routes — submit goals, inspect runs, tasks and artifacts.
 */

import { Router } from 'express'
import { z } from 'zod'
import { store } from '../state'
import { makeGoal, startRun, cancelRun } from '../engine/orchestrator'
import { artifactRepo } from '../db/repositories/knowledgeRepo'

export const runsRouter = Router()

const goalSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(4000),
  constraints: z.array(z.string().max(200)).max(20).optional(),
  stack: z.array(z.string().max(60)).max(20).optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
})

/** POST /api/runs — submit a product goal and start a run. */
runsRouter.post('/', (req, res) => {
  const parsed = goalSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid goal', issues: parsed.error.flatten() })
  }
  const goal = makeGoal(parsed.data)
  const run = startRun(goal)
  res.status(201).json({ runId: run.id, run })
})

/** GET /api/runs — list runs (most recent first). */
runsRouter.get('/', (_req, res) => {
  res.json({ runs: store.runs().slice(0, 100) })
})

/** GET /api/runs/:id — a single run. */
runsRouter.get('/:id', (req, res) => {
  const run = store.run(req.params.id)
  if (!run) return res.status(404).json({ error: 'run not found' })
  res.json({ run })
})

/** GET /api/runs/:id/tasks — the run's task DAG. */
runsRouter.get('/:id/tasks', (req, res) => {
  const run = store.run(req.params.id)
  if (!run) return res.status(404).json({ error: 'run not found' })
  res.json({ tasks: store.tasksOfRun(req.params.id) })
})

/** GET /api/runs/:id/artifacts — generated code artifacts. */
runsRouter.get('/:id/artifacts', (req, res) => {
  const fromMem = store.artifactsOfRun(req.params.id)
  const artifacts = fromMem.length ? fromMem : artifactRepo.listByRun(req.params.id)
  res.json({ artifacts })
})

/** POST /api/runs/:id/cancel — cancel an in-flight run. */
runsRouter.post('/:id/cancel', (req, res) => {
  const run = store.run(req.params.id)
  if (!run) return res.status(404).json({ error: 'run not found' })
  cancelRun(run)
  res.json({ run })
})
