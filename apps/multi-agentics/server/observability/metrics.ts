/**
 * In-memory time-series metrics collector.
 *
 * Keeps a bounded rolling window per series and emits a 'metric' event whenever
 * a point is recorded so the Observability charts can stream. Also exposes a few
 * gauges that the platform snapshot reads.
 */

import { bus } from '../engine/eventBus'
import type { MetricPoint, MetricSeries } from '@shared/types'

const WINDOW = 120 // points retained per series

interface SeriesDef {
  label: string
  unit: string
  points: MetricPoint[]
}

const series = new Map<string, SeriesDef>()

function ensure(key: string, label: string, unit: string): SeriesDef {
  let s = series.get(key)
  if (!s) {
    s = { label, unit, points: [] }
    series.set(key, s)
  }
  return s
}

export const metrics = {
  /** Record an absolute value for a gauge-style series. */
  gauge(key: string, label: string, unit: string, value: number) {
    const s = ensure(key, label, unit)
    const point: MetricPoint = { ts: Date.now(), value }
    s.points.push(point)
    if (s.points.length > WINDOW) s.points.shift()
    bus.emit('metric', { key, label, unit, point })
  },

  /** Increment a counter-style series by `delta` (default 1). */
  increment(key: string, label: string, unit: string, delta = 1) {
    const s = ensure(key, label, unit)
    const last = s.points.at(-1)?.value ?? 0
    this.gauge(key, label, unit, last + delta)
  },

  get(key: string): MetricSeries | null {
    const s = series.get(key)
    return s ? { key, label: s.label, unit: s.unit, points: s.points } : null
  },

  all(): MetricSeries[] {
    return [...series.entries()].map(([key, s]) => ({ key, label: s.label, unit: s.unit, points: s.points }))
  },
}
