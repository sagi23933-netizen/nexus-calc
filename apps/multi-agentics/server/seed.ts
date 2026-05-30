/**
 * Seed script — initialises the database, persists the seeded knowledge base
 * and runs one demo build so a fresh checkout has data to explore.
 *
 *   npm run seed
 */

import { getDb } from './db/db'
import { initState, store } from './state'
import { vectorRepo } from './db/repositories/knowledgeRepo'
import { makeGoal, startRun } from './engine/orchestrator'

async function waitForRun(runId: string, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const run = store.run(runId)
    if (run && ['completed', 'failed', 'cancelled', 'awaiting_approval'].includes(run.status)) return run
    await new Promise((r) => setTimeout(r, 250))
  }
  return store.run(runId)
}

async function main() {
  getDb()
  initState()

  // Persist the seeded vector docs so semantic search survives a restart.
  for (const doc of store.vectors()) vectorRepo.upsert(doc)
  // eslint-disable-next-line no-console
  console.log(`Seeded ${store.vectors().length} knowledge documents.`)

  const goal = makeGoal({
    title: 'Realtime collaborative task board',
    description: 'Build a multi-tenant Kanban app with realtime sync, auth, billing and an analytics dashboard. Must scale to thousands of concurrent boards.',
    stack: ['typescript', 'react', 'node', 'postgres', 'redis'],
    constraints: ['SOC2-ready', 'sub-200ms interactions', 'mobile responsive'],
    priority: 'high',
  })
  const run = startRun(goal)
  // eslint-disable-next-line no-console
  console.log(`Started demo run ${run.id} — "${goal.title}"`)

  const finished = await waitForRun(run.id)
  // eslint-disable-next-line no-console
  console.log(`Demo run ${finished?.id} ended in status: ${finished?.status} (${finished?.metrics.linesOfCode.toLocaleString()} LoC, ${finished?.metrics.filesGenerated} files).`)
  if (finished?.status === 'awaiting_approval') {
    // eslint-disable-next-line no-console
    console.log('The demo run is awaiting human approval — open the Governance page to approve it.')
  }
  process.exit(0)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('seed failed:', err)
  process.exit(1)
})
