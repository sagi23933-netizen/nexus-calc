/**
 * Persistence for the knowledge layer: shared memory, vector docs and code
 * artifacts.
 */

import { getDb } from '../db'
import type { CodeArtifact, MemoryEntry, VectorDoc } from '@shared/types'

export const memoryRepo = {
  upsert(entry: MemoryEntry) {
    getDb()
      .prepare(
        `INSERT INTO memory (id, run_id, key, value, scope, updated_at)
         VALUES (@id, @run_id, @key, @value, @scope, @updated_at)
         ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      )
      .run({
        id: entry.id,
        run_id: entry.runId,
        key: entry.key,
        value: entry.value,
        scope: entry.scope,
        updated_at: entry.updatedAt,
      })
  },

  list(scope?: string): MemoryEntry[] {
    const rows = scope
      ? (getDb().prepare('SELECT id, run_id as runId, key, value, scope, updated_at as updatedAt FROM memory WHERE scope = ? ORDER BY updated_at DESC').all(scope) as MemoryEntry[])
      : (getDb().prepare('SELECT id, run_id as runId, key, value, scope, updated_at as updatedAt FROM memory ORDER BY updated_at DESC LIMIT 500').all() as MemoryEntry[])
    return rows
  },
}

export const vectorRepo = {
  upsert(doc: VectorDoc) {
    getDb()
      .prepare(
        `INSERT INTO vectors (id, title, text, source, tags, embedding)
         VALUES (@id, @title, @text, @source, @tags, @embedding)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, text=excluded.text,
           source=excluded.source, tags=excluded.tags, embedding=excluded.embedding`,
      )
      .run({
        id: doc.id,
        title: doc.title,
        text: doc.text,
        source: doc.source,
        tags: JSON.stringify(doc.tags),
        embedding: JSON.stringify(doc.embedding),
      })
  },

  all(): VectorDoc[] {
    const rows = getDb().prepare('SELECT * FROM vectors').all() as Array<{
      id: string; title: string; text: string; source: string; tags: string; embedding: string
    }>
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      text: r.text,
      source: r.source,
      tags: JSON.parse(r.tags) as string[],
      embedding: JSON.parse(r.embedding) as number[],
    }))
  },

  count(): number {
    return (getDb().prepare('SELECT COUNT(*) c FROM vectors').get() as { c: number }).c
  },
}

export const artifactRepo = {
  insert(a: CodeArtifact) {
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO artifacts (id, run_id, path, language, lines, bytes, task_id, preview, created_at)
         VALUES (@id, @run_id, @path, @language, @lines, @bytes, @task_id, @preview, @created_at)`,
      )
      .run({
        id: a.id,
        run_id: a.runId,
        path: a.path,
        language: a.language,
        lines: a.lines,
        bytes: a.bytes,
        task_id: a.taskId,
        preview: a.preview,
        created_at: a.createdAt,
      })
  },

  listByRun(runId: string): CodeArtifact[] {
    return getDb()
      .prepare('SELECT id, run_id as runId, path, language, lines, bytes, task_id as taskId, preview, created_at as createdAt FROM artifacts WHERE run_id = ? ORDER BY path')
      .all(runId) as CodeArtifact[]
  },

  totals(): { files: number; lines: number } {
    const r = getDb().prepare('SELECT COUNT(*) files, COALESCE(SUM(lines),0) lines FROM artifacts').get() as { files: number; lines: number }
    return r
  },
}
