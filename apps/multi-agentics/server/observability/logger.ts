/**
 * Structured logger.
 *
 * Every log line is (a) printed to stdout, (b) persisted to SQLite for history,
 * and (c) emitted on the event bus so the SSE stream and the live log panel in
 * the UI update in real time. Producers just call `logger.info(...)` etc.
 */

import { nanoid } from 'nanoid'
import { bus } from '../engine/eventBus'
import { logsRepo } from '../db/repositories/logsRepo'
import type { LogEntry, Severity } from '@shared/types'

const RING_LIMIT = 1000
const ring: LogEntry[] = []

function write(severity: Severity, source: string, message: string, runId: string | null) {
  const entry: LogEntry = { id: nanoid(10), ts: Date.now(), runId, source, severity, message }
  ring.push(entry)
  if (ring.length > RING_LIMIT) ring.shift()
  try {
    logsRepo.insert(entry)
  } catch {
    // Persistence is best-effort; never block the producer on a log write.
  }
  bus.emit('log', entry, runId)
  if (severity === 'error' || severity === 'critical') {
    // eslint-disable-next-line no-console
    console.error(`[${source}] ${message}`)
  }
}

export const logger = {
  debug: (source: string, message: string, runId: string | null = null) => write('debug', source, message, runId),
  info: (source: string, message: string, runId: string | null = null) => write('info', source, message, runId),
  notice: (source: string, message: string, runId: string | null = null) => write('notice', source, message, runId),
  warn: (source: string, message: string, runId: string | null = null) => write('warning', source, message, runId),
  error: (source: string, message: string, runId: string | null = null) => write('error', source, message, runId),
  critical: (source: string, message: string, runId: string | null = null) => write('critical', source, message, runId),

  /** In-memory recent lines (fast path for the dashboard initial load). */
  recent: (runId?: string | null, limit = 200): LogEntry[] => {
    const items = runId ? ring.filter((l) => l.runId === runId) : ring
    return items.slice(-limit).reverse()
  },
}
