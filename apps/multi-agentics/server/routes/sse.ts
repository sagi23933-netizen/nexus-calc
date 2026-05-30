/**
 * Server-Sent Events endpoint.
 *
 * Clients subscribe to the engine event stream and receive deltas in real time
 * (run/task/agent updates, logs, metrics, gates, approvals). Optionally filtered
 * by `?run=<id>`. New subscribers get a short backfill of recent events so the
 * UI can render immediately without a separate fetch.
 */

import { Router } from 'express'
import { bus } from '../engine/eventBus'

export const sseRouter = Router()

sseRouter.get('/events', (req, res) => {
  const runFilter = (req.query.run as string | undefined) ?? null

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(': connected\n\n')

  const send = (event: { type: string; ts: number; runId: string | null; payload: unknown }) => {
    if (runFilter && event.runId && event.runId !== runFilter) return
    // Deliberately unnamed (default "message") so the browser EventSource
    // `onmessage` handler receives every event; the type travels in the payload.
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  // Backfill recent history so the client is immediately in sync.
  for (const event of bus.recent(runFilter, 100)) send(event)

  const unsubscribe = bus.on('*', send)

  // Heartbeat keeps proxies from closing an idle connection.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000)

  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
    res.end()
  })
})
