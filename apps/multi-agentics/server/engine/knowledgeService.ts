/**
 * Knowledge-layer service: Vector DB search + Shared Memory writes.
 *
 * Wraps the in-memory vector store with cosine similarity search and provides a
 * convenience for agents/engine to write run-scoped memory. Backed by the
 * embedding helper so it works with zero external dependencies.
 */

import { nanoid } from 'nanoid'
import { store } from '../state'
import { embed, cosine } from './embedding'
import { memoryRepo, vectorRepo } from '../db/repositories/knowledgeRepo'
import type { MemoryEntry, VectorDoc, VectorSearchHit } from '@shared/types'

/** Semantic search across the vector store. Returns top-k hits sorted by score. */
export function searchVectors(query: string, k = 5): VectorSearchHit[] {
  const q = embed(query)
  const hits = store
    .vectors()
    .map((doc) => ({ doc, score: cosine(q, doc.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ doc, score }) => ({
      doc: { id: doc.id, title: doc.title, text: doc.text, source: doc.source, tags: doc.tags } as Omit<VectorDoc, 'embedding'>,
      score: Number(score.toFixed(4)),
    }))
  return hits
}

/** Index a new document into the vector store (used when runs learn something). */
export function indexDocument(input: { title: string; text: string; source: string; tags?: string[] }): VectorDoc {
  const doc: VectorDoc = {
    id: `vec_${nanoid(8)}`,
    title: input.title,
    text: input.text,
    source: input.source,
    tags: input.tags ?? [],
    embedding: embed(`${input.title}. ${input.text}`),
  }
  store.setVector(doc)
  try {
    vectorRepo.upsert(doc)
  } catch {
    /* best effort */
  }
  return doc
}

/** Write or update a shared-memory entry. */
export function remember(key: string, value: string, scope: MemoryEntry['scope'] = 'global', runId: string | null = null): MemoryEntry {
  const existing = store.memory().find((m) => m.key === key && m.runId === runId)
  const entry: MemoryEntry = existing
    ? { ...existing, value, updatedAt: Date.now() }
    : { id: `mem_${nanoid(8)}`, runId, key, value, scope, updatedAt: Date.now() }
  store.setMemory(entry)
  try {
    memoryRepo.upsert(entry)
  } catch {
    /* best effort */
  }
  return entry
}
