/**
 * Persistence + query for log entries (observability).
 */

import { getDb } from '../db'
import type { LogEntry, Severity } from '@shared/types'

export const logsRepo = {
  insert(entry: LogEntry) {
    getDb()
      .prepare('INSERT OR REPLACE INTO logs (id, ts, run_id, source, severity, message) VALUES (?, ?, ?, ?, ?, ?)')
      .run(entry.id, entry.ts, entry.runId, entry.source, entry.severity, entry.message)
  },

  query(opts: { runId?: string; severity?: Severity; limit?: number } = {}): LogEntry[] {
    const clauses: string[] = []
    const params: unknown[] = []
    if (opts.runId) {
      clauses.push('run_id = ?')
      params.push(opts.runId)
    }
    if (opts.severity) {
      clauses.push('severity = ?')
      params.push(opts.severity)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    params.push(opts.limit ?? 200)
    const rows = getDb()
      .prepare(`SELECT id, ts, run_id as runId, source, severity, message FROM logs ${where} ORDER BY ts DESC LIMIT ?`)
      .all(...params) as LogEntry[]
    return rows
  },
}
