/**
 * Tools & APIs routes: registry + auto-configuration flow.
 */

import { Router } from 'express'
import { store } from '../state'
import { configureTool, disconnectTool, provisionProgress } from '../engine/toolsService'

export const toolsRouter = Router()

/** GET /api/tools — the provider registry (optionally by category). */
toolsRouter.get('/', (req, res) => {
  const category = req.query.category as string | undefined
  const tools = category ? store.tools().filter((t) => t.category === category) : store.tools()
  res.json({
    tools,
    summary: {
      total: store.tools().length,
      connected: store.tools().filter((t) => t.status === 'connected').length,
    },
  })
})

/** POST /api/tools/:id/configure — kick off auto-registration. */
toolsRouter.post('/:id/configure', (req, res) => {
  const result = configureTool(req.params.id)
  if (!result.ok) return res.status(400).json({ error: result.error })
  res.status(202).json({ steps: result.steps, tool: store.tool(req.params.id) })
})

/** GET /api/tools/:id/progress — provisioning step progress. */
toolsRouter.get('/:id/progress', (req, res) => {
  res.json({ steps: provisionProgress(req.params.id), tool: store.tool(req.params.id) })
})

/** POST /api/tools/:id/disconnect */
toolsRouter.post('/:id/disconnect', (req, res) => {
  const ok = disconnectTool(req.params.id)
  if (!ok) return res.status(404).json({ error: 'tool not found' })
  res.json({ tool: store.tool(req.params.id) })
})
