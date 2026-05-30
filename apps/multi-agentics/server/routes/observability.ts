/**
 * Observability routes: logs, metrics and traces.
 */

import { Router } from 'express'
import { logger } from '../observability/logger'
import { metrics } from '../observability/metrics'
import { tracing } from '../observability/tracing'
import { logsRepo } from '../db/repositories/logsRepo'
import type { Severity } from '@shared/types'

export const observabilityRouter = Router()

/** GET /api/observability/logs — recent logs (memory ring, falls back to DB). */
observabilityRouter.get('/logs', (req, res) => {
  const runId = req.query.run as string | undefined
  const severity = req.query.severity as Severity | undefined
  const limit = Math.min(500, Number(req.query.limit ?? 200) || 200)
  let entries = logger.recent(runId, limit)
  if (entries.length === 0) entries = logsRepo.query({ runId, severity, limit })
  if (severity) entries = entries.filter((e) => e.severity === severity)
  res.json({ logs: entries })
})

/** GET /api/observability/metrics — all metric series (or one by key). */
observabilityRouter.get('/metrics', (req, res) => {
  const key = req.query.key as string | undefined
  if (key) {
    const series = metrics.get(key)
    return res.json({ series })
  }
  res.json({ series: metrics.all() })
})

/** GET /api/observability/traces/:runId — trace spans for a run. */
observabilityRouter.get('/traces/:runId', (req, res) => {
  res.json({ spans: tracing.forRun(req.params.runId) })
})
