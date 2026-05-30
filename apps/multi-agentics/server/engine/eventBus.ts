/**
 * Event bus — the decoupling backbone of the engine.
 *
 * Producers (orchestrator, scheduler, agents, validators) emit typed events
 * without knowing who consumes them. Consumers (SSE broadcaster, observability
 * collectors, the DB persister) subscribe independently. Because publishing
 * never blocks on consumers, no single slow subscriber can create a bottleneck
 * for the producers — satisfying the "no bottlenecks" design requirement.
 */

import type { EngineEvent, EngineEventType } from '@shared/types'

type Handler = (event: EngineEvent) => void

class EventBus {
  private handlers = new Map<EngineEventType | '*', Set<Handler>>()
  private buffer: EngineEvent[] = []
  private readonly bufferLimit = 2000

  /** Subscribe to one event type, or '*' for every event. Returns an unsubscribe fn. */
  on(type: EngineEventType | '*', handler: Handler): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler)
    return () => set!.delete(handler)
  }

  /** Publish an event. Handler exceptions are isolated so one bad consumer can't break others. */
  emit<T>(type: EngineEventType, payload: T, runId: string | null = null): EngineEvent<T> {
    const event: EngineEvent<T> = { type, ts: Date.now(), runId, payload }
    this.record(event)

    const dispatch = (set?: Set<Handler>) => {
      if (!set) return
      for (const handler of set) {
        try {
          handler(event as EngineEvent)
        } catch (err) {
          // Never let a subscriber failure propagate back to the producer.
          // eslint-disable-next-line no-console
          console.error(`[eventBus] handler for "${type}" threw:`, err)
        }
      }
    }

    dispatch(this.handlers.get(type))
    dispatch(this.handlers.get('*'))
    return event
  }

  /** Keep a rolling buffer so late SSE subscribers can backfill recent history. */
  private record(event: EngineEvent) {
    this.buffer.push(event)
    if (this.buffer.length > this.bufferLimit) {
      this.buffer.splice(0, this.buffer.length - this.bufferLimit)
    }
  }

  /** Recent events, optionally filtered by run, for backfilling a new subscriber. */
  recent(runId?: string | null, limit = 200): EngineEvent[] {
    const items = runId ? this.buffer.filter((e) => e.runId === runId) : this.buffer
    return items.slice(-limit)
  }

  subscriberCount(): number {
    let total = 0
    for (const set of this.handlers.values()) total += set.size
    return total
  }
}

/** Singleton bus shared across the whole backend process. */
export const bus = new EventBus()
