/**
 * Persistence for the human-approval queue.
 */

import { getDb } from '../db'
import type { ApprovalRequest } from '@shared/types'

export const approvalsRepo = {
  upsert(req: ApprovalRequest) {
    getDb()
      .prepare(
        `INSERT INTO approvals (id, run_id, status, created_at, data)
         VALUES (@id, @run_id, @status, @created_at, @data)
         ON CONFLICT(id) DO UPDATE SET status=excluded.status, data=excluded.data`,
      )
      .run({
        id: req.id,
        run_id: req.runId,
        status: req.status,
        created_at: req.createdAt,
        data: JSON.stringify(req),
      })
  },

  get(id: string): ApprovalRequest | null {
    const row = getDb().prepare('SELECT data FROM approvals WHERE id = ?').get(id) as { data: string } | undefined
    return row ? (JSON.parse(row.data) as ApprovalRequest) : null
  },

  list(status?: ApprovalRequest['status']): ApprovalRequest[] {
    const rows = status
      ? (getDb().prepare('SELECT data FROM approvals WHERE status = ? ORDER BY created_at DESC').all(status) as { data: string }[])
      : (getDb().prepare('SELECT data FROM approvals ORDER BY created_at DESC LIMIT 200').all() as { data: string }[])
    return rows.map((r) => JSON.parse(r.data) as ApprovalRequest)
  },
}
