/**
 * Knowledge-layer routes: shared memory, vector search, code artifacts.
 */

import { Router } from 'express'
import { z } from 'zod'
import { store } from '../state'
import { searchVectors, indexDocument, remember } from '../engine/knowledgeService'

export const knowledgeRouter = Router()

/** GET /api/knowledge/memory — shared memory entries. */
knowledgeRouter.get('/memory', (req, res) => {
  const scope = req.query.scope as string | undefined
  const entries = scope ? store.memory().filter((m) => m.scope === scope) : store.memory()
  res.json({ entries })
})

/** POST /api/knowledge/memory — write a shared-memory entry. */
const memSchema = z.object({ key: z.string().min(1), value: z.string(), scope: z.enum(['global', 'run', 'team']).optional(), runId: z.string().nullable().optional() })
knowledgeRouter.post('/memory', (req, res) => {
  const parsed = memSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid memory entry' })
  const entry = remember(parsed.data.key, parsed.data.value, parsed.data.scope ?? 'global', parsed.data.runId ?? null)
  res.status(201).json({ entry })
})

/** GET /api/knowledge/vectors — list indexed documents (without embeddings). */
knowledgeRouter.get('/vectors', (_req, res) => {
  const docs = store.vectors().map(({ embedding, ...rest }) => {
    void embedding
    return rest
  })
  res.json({ docs, dim: store.vectors()[0]?.embedding.length ?? 0 })
})

/** POST /api/knowledge/search — semantic search over the vector DB. */
const searchSchema = z.object({ query: z.string().min(1).max(500), k: z.number().int().min(1).max(20).optional() })
knowledgeRouter.post('/search', (req, res) => {
  const parsed = searchSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid search' })
  const hits = searchVectors(parsed.data.query, parsed.data.k ?? 5)
  res.json({ hits })
})

/** POST /api/knowledge/vectors — index a new document. */
const indexSchema = z.object({ title: z.string().min(1), text: z.string().min(1), source: z.string().optional(), tags: z.array(z.string()).optional() })
knowledgeRouter.post('/vectors', (req, res) => {
  const parsed = indexSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid document' })
  const doc = indexDocument({ title: parsed.data.title, text: parsed.data.text, source: parsed.data.source ?? 'user', tags: parsed.data.tags })
  const { embedding, ...rest } = doc
  void embedding
  res.status(201).json({ doc: rest })
})

/** GET /api/knowledge/artifacts — generated code artifacts across runs. */
knowledgeRouter.get('/artifacts', (req, res) => {
  const runId = req.query.run as string | undefined
  const artifacts = runId ? store.artifactsOfRun(runId) : store.artifacts().slice(0, 300)
  res.json({ artifacts })
})
