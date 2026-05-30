/**
 * React hook for the live Server-Sent Events stream.
 *
 * Opens a single EventSource to /sse/events (optionally filtered by run) and
 * invokes the handler for every engine event. Auto-reconnects on drop.
 */

import { useEffect, useRef } from 'react'
import type { EngineEvent } from '@shared/types'

export function useEventStream(onEvent: (event: EngineEvent) => void, runId?: string | null) {
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    const url = `/sse/events${runId ? `?run=${encodeURIComponent(runId)}` : ''}`
    let source: EventSource | null = null
    let closed = false

    const connect = () => {
      if (closed) return
      source = new EventSource(url)
      source.onmessage = (e) => {
        try {
          handlerRef.current(JSON.parse(e.data) as EngineEvent)
        } catch {
          /* ignore malformed frames */
        }
      }
      // The server tags events with `event: <type>`; listen generically too.
      source.addEventListener('error', () => {
        source?.close()
        if (!closed) setTimeout(connect, 2000)
      })
    }
    connect()

    return () => {
      closed = true
      source?.close()
    }
  }, [runId])
}

/**
 * Lower-level subscription (non-hook) for components that manage their own
 * lifecycle. Returns a close function.
 */
export function subscribeEvents(onEvent: (event: EngineEvent) => void, runId?: string | null): () => void {
  const url = `/sse/events${runId ? `?run=${encodeURIComponent(runId)}` : ''}`
  const source = new EventSource(url)
  source.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data) as EngineEvent)
    } catch {
      /* ignore */
    }
  }
  return () => source.close()
}
