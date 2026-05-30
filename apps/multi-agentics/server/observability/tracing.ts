/**
 * Minimal distributed-tracing collector.
 *
 * Spans model the causal tree of a run: the orchestrator opens a root span,
 * the planner / teams / agents open child spans. The Observability page renders
 * these as a waterfall. Spans are held in memory per run (bounded).
 */

import { nanoid } from 'nanoid'
import type { TraceSpan } from '@shared/types'

const spansByRun = new Map<string, TraceSpan[]>()
const MAX_SPANS_PER_RUN = 500

export const tracing = {
  start(runId: string, name: string, parentId: string | null = null, attributes: Record<string, string | number> = {}): TraceSpan {
    const span: TraceSpan = {
      id: nanoid(10),
      runId,
      parentId,
      name,
      startTs: Date.now(),
      endTs: null,
      status: 'running',
      attributes,
    }
    const list = spansByRun.get(runId) ?? []
    list.push(span)
    if (list.length > MAX_SPANS_PER_RUN) list.shift()
    spansByRun.set(runId, list)
    return span
  },

  end(span: TraceSpan, status: 'ok' | 'error' = 'ok', extra: Record<string, string | number> = {}) {
    span.endTs = Date.now()
    span.status = status
    Object.assign(span.attributes, extra)
  },

  forRun(runId: string): TraceSpan[] {
    return spansByRun.get(runId) ?? []
  },
}
