/**
 * Persistence for production deployments.
 */

import { getDb } from '../db'
import type { Deployment } from '@shared/types'

export const deploymentsRepo = {
  upsert(d: Deployment) {
    getDb()
      .prepare(
        `INSERT INTO deployments (id, run_id, environment, status, url, version, created_at, lines)
         VALUES (@id, @run_id, @environment, @status, @url, @version, @created_at, @lines)
         ON CONFLICT(id) DO UPDATE SET status=excluded.status, url=excluded.url`,
      )
      .run({
        id: d.id,
        run_id: d.runId,
        environment: d.environment,
        status: d.status,
        url: d.url,
        version: d.version,
        created_at: d.createdAt,
        lines: d.linesOfCode,
      })
  },

  list(limit = 100): Deployment[] {
    return getDb()
      .prepare('SELECT id, run_id as runId, environment, status, url, version, created_at as createdAt, lines as linesOfCode FROM deployments ORDER BY created_at DESC LIMIT ?')
      .all(limit) as Deployment[]
  },

  count(): { total: number; live: number } {
    const db = getDb()
    const total = (db.prepare('SELECT COUNT(*) c FROM deployments').get() as { c: number }).c
    const live = (db.prepare("SELECT COUNT(*) c FROM deployments WHERE status='live'").get() as { c: number }).c
    return { total, live }
  },
}
