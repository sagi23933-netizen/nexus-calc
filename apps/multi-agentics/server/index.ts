/**
 * Express backend bootstrap for New Level Multi-Agentics.
 *
 * Wires the REST API, the SSE stream and (in production) the built frontend.
 * Initialises the durable store and seeds the in-memory catalog, and registers
 * the in-process MCP server descriptor so the UI can advertise it.
 */

import express from 'express'
import compression from 'compression'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

import { getDb } from './db/db'
import { initState, store } from './state'
import { logger } from './observability/logger'
import { metrics } from './observability/metrics'
import { DEFAULT_API_PORT } from '@shared/constants'
import { MCP_SERVER_META } from './mcp/server'
import { mcpToolInfo } from './mcp/tools'

import { runsRouter } from './routes/runs'
import { teamsRouter, agentsRouter } from './routes/teams'
import { knowledgeRouter } from './routes/knowledge'
import { governanceRouter } from './routes/governance'
import { observabilityRouter } from './routes/observability'
import { toolsRouter } from './routes/tools'
import { productionRouter, snapshotRouter } from './routes/production'
import { mcpRouter } from './routes/mcp'
import { sseRouter } from './routes/sse'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? DEFAULT_API_PORT)

function registerMcpDescriptor() {
  const tools = mcpToolInfo()
  store.setMcpServer({
    id: 'mcp_primary',
    name: MCP_SERVER_META.name,
    transport: 'stdio',
    status: 'active',
    toolCount: tools.length,
    tools,
    description: 'Primary MCP server exposing the orchestration engine (submit_goal, get_run, search_knowledge, approve_task, get_metrics …).',
  })
}

/** Background telemetry tick so the dashboards always have a live pulse. */
function startTelemetryHeartbeat() {
  setInterval(() => {
    const agents = store.agents()
    const busy = agents.filter((a) => a.status === 'busy').length
    metrics.gauge('agents_busy', 'Busy agents', 'agents', busy)
    metrics.gauge('runs_active', 'Active runs', 'runs', store.activeRuns().length)
  }, 5000)
}

export function createApp() {
  getDb()
  initState()
  registerMcpDescriptor()

  const app = express()
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors())
  app.use(compression())
  app.use(express.json({ limit: '1mb' }))
  if (process.env.NODE_ENV !== 'test') app.use(morgan('tiny'))

  // Health.
  app.get('/api/health', (_req, res) => res.json({ ok: true, product: MCP_SERVER_META.name, ts: Date.now() }))

  // REST API.
  app.use('/api/runs', runsRouter)
  app.use('/api/teams', teamsRouter)
  app.use('/api/agents', agentsRouter)
  app.use('/api/knowledge', knowledgeRouter)
  app.use('/api/governance', governanceRouter)
  app.use('/api/observability', observabilityRouter)
  app.use('/api/tools', toolsRouter)
  app.use('/api/production', productionRouter)
  app.use('/api/snapshot', snapshotRouter)
  app.use('/api/mcp', mcpRouter)

  // Live event stream.
  app.use('/sse', sseRouter)

  // Serve the built frontend in production (single-origin deploy).
  const webDist = join(__dirname, '..', 'dist', 'web')
  if (existsSync(webDist)) {
    app.use(express.static(webDist))
    app.get('*', (_req, res) => res.sendFile(join(webDist, 'index.html')))
  }

  return app
}

function main() {
  const app = createApp()
  startTelemetryHeartbeat()
  app.listen(PORT, () => {
    logger.info('server', `New Level Multi-Agentics API listening on :${PORT}`)
    // eslint-disable-next-line no-console
    console.log(`\n  ▸ New Level Multi-Agentics — by GreenBook AI`)
    // eslint-disable-next-line no-console
    console.log(`  ▸ API ready at http://localhost:${PORT}/api/health\n`)
  })
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('index.ts')
if (invokedDirectly) main()
