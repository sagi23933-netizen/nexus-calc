/**
 * Persistence for runs and their tasks.
 */

import { getDb } from '../db'
import type { Run, Task } from '@shared/types'

export const runsRepo = {
  upsert(run: Run) {
    getDb()
      .prepare(
        `INSERT INTO runs (id, status, title, created_at, finished_at, version, data)
         VALUES (@id, @status, @title, @created_at, @finished_at, @version, @data)
         ON CONFLICT(id) DO UPDATE SET
           status=excluded.status, title=excluded.title,
           finished_at=excluded.finished_at, version=excluded.version, data=excluded.data`,
      )
      .run({
        id: run.id,
        status: run.status,
        title: run.goal.title,
        created_at: run.createdAt,
        finished_at: run.finishedAt,
        version: run.version,
        data: JSON.stringify(run),
      })
  },

  get(id: string): Run | null {
    const row = getDb().prepare('SELECT data FROM runs WHERE id = ?').get(id) as { data: string } | undefined
    return row ? (JSON.parse(row.data) as Run) : null
  },

  list(limit = 100): Run[] {
    const rows = getDb()
      .prepare('SELECT data FROM runs ORDER BY created_at DESC LIMIT ?')
      .all(limit) as { data: string }[]
    return rows.map((r) => JSON.parse(r.data) as Run)
  },

  count(): { active: number; completed: number; failed: number; total: number } {
    const db = getDb()
    const total = (db.prepare('SELECT COUNT(*) c FROM runs').get() as { c: number }).c
    const completed = (db.prepare("SELECT COUNT(*) c FROM runs WHERE status='completed'").get() as { c: number }).c
    const failed = (db.prepare("SELECT COUNT(*) c FROM runs WHERE status IN ('failed','cancelled')").get() as { c: number }).c
    return { active: total - completed - failed, completed, failed, total }
  },
}

export const tasksRepo = {
  upsert(task: Task) {
    getDb()
      .prepare(
        `INSERT INTO tasks (id, run_id, status, team_kind, data)
         VALUES (@id, @run_id, @status, @team_kind, @data)
         ON CONFLICT(id) DO UPDATE SET status=excluded.status, data=excluded.data`,
      )
      .run({
        id: task.id,
        run_id: task.runId,
        status: task.status,
        team_kind: task.teamKind,
        data: JSON.stringify(task),
      })
  },

  upsertMany(tasks: Task[]) {
    const tx = getDb().transaction((items: Task[]) => {
      for (const t of items) tasksRepo.upsert(t)
    })
    tx(tasks)
  },

  listByRun(runId: string): Task[] {
    const rows = getDb().prepare('SELECT data FROM tasks WHERE run_id = ?').all(runId) as { data: string }[]
    return rows.map((r) => JSON.parse(r.data) as Task)
  },
}
