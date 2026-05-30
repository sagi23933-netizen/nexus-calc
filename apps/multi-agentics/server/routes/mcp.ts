/**
 * MCP routes — expose the in-process MCP server descriptor and its tools to the
 * UI so the MCP page can show what external clients can call.
 */

import { Router } from 'express'
import { store } from '../state'
import { mcpToolInfo } from '../mcp/tools'

export const mcpRouter = Router()

/** GET /api/mcp/servers — registered MCP servers and their tools. */
mcpRouter.get('/servers', (_req, res) => {
  res.json({ servers: store.mcpServers() })
})

/** GET /api/mcp/tools — the tools exposed by the primary MCP server. */
mcpRouter.get('/tools', (_req, res) => {
  res.json({ tools: mcpToolInfo() })
})
