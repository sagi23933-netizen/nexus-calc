/**
 * Production routes: deployments and the platform snapshot.
 */

import { Router } from 'express'
import { store } from '../state'
import { deploymentsRepo } from '../db/repositories/deploymentsRepo'
import { runsRepo } from '../db/repositories/runsRepo'
import { artifactRepo } from '../db/repositories/knowledgeRepo'
import type { PlatformSnapshot } from '@shared/types'

export const productionRouter = Router()

/** GET /api/production/deployments */
productionRouter.get('/deployments', (_req, res) => {
  res.json({ deployments: deploymentsRepo.list(100) })
})

export const snapshotRouter = Router()

/** GET /api/snapshot — aggregate dashboard numbers. */
snapshotRouter.get('/', (_req, res) => {
  const agents = store.agents()
  const tools = store.tools()
  const runCounts = runsRepo.count()
  const deployCounts = deploymentsRepo.count()
  const artifactTotals = artifactRepo.totals()
  const tasksCompleted = store.agents().reduce((s, a) => s + a.stats.tasksCompleted, 0)
  const tokensUsed = store.agents().reduce((s, a) => s + a.stats.tokensUsed, 0)

  const snapshot: PlatformSnapshot = {
    runs: runCounts,
    agents: {
      total: agents.length,
      active: agents.filter((a) => a.status === 'busy' || a.status === 'active').length,
      idle: agents.filter((a) => a.status === 'idle').length,
    },
    teams: store.teams().length,
    tools: { total: tools.length, connected: tools.filter((t) => t.status === 'connected').length },
    mcpServers: store.mcpServers().length,
    deployments: deployCounts,
    totals: {
      linesOfCode: artifactTotals.lines,
      filesGenerated: artifactTotals.files,
      tokensUsed,
      tasksCompleted,
    },
  }
  res.json({ snapshot })
})
