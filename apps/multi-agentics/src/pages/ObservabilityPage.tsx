/**
 * Observability — live logs, metric series (with sparklines) and the metric
 * gauges, all streaming over SSE. Mirrors the diagram's left "Observability"
 * rail (Logs · Metrics · Tracing).
 */

import { useEffect, useState } from 'react'
import { Activity, ScrollText, Gauge } from 'lucide-react'
import { api } from '../api/client'
import { subscribeEvents } from '../api/sse'
import { Card, SectionTitle, Sparkline } from '../components/ui'
import { clockTime } from '../lib/format'
import { SEVERITY_COLOR } from '../lib/status'
import type { LogEntry, MetricSeries } from '@shared/types'

export default function ObservabilityPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [series, setSeries] = useState<MetricSeries[]>([])
  const [severity, setSeverity] = useState<string>('all')

  useEffect(() => {
    void api.logs({ limit: 100 }).then(setLogs)
    void api.metrics().then(setSeries)
    const refresh = setInterval(() => void api.metrics().then(setSeries), 4000)
    const close = subscribeEvents((event) => {
      if (event.type === 'log') setLogs((prev) => [event.payload as LogEntry, ...prev].slice(0, 150))
    })
    return () => {
      clearInterval(refresh)
      close()
    }
  }, [])

  const shown = severity === 'all' ? logs : logs.filter((l) => l.severity === severity)
  const severities = ['all', 'info', 'notice', 'warning', 'error']

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle title="Observability" subtitle="Logs · Metrics · Tracing — streamed live from the engine" />

      {/* Metrics */}
      <div>
        <div className="flex items-center gap-2 mb-3 text-[var(--text-muted)] text-sm font-semibold"><Gauge size={16} /> Metrics</div>
        <div className="grid-cards">
          {series.length === 0 && <Card className="text-sm text-[var(--text-muted)]">Metrics populate as runs execute.</Card>}
          {series.map((s) => {
            const latest = s.points.at(-1)?.value ?? 0
            return (
              <Card key={s.key} className="flex flex-col gap-2">
                <span className="stat-label">{s.label}</span>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold">{Math.round(latest).toLocaleString()}</span>
                  <Sparkline points={s.points.map((p) => p.value)} />
                </div>
                <span className="text-xs text-[var(--text-dim)]">{s.unit}</span>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Logs */}
      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm font-semibold"><ScrollText size={16} /> Live log stream</div>
          <div className="flex gap-1.5">
            {severities.map((s) => (
              <button key={s} className={`btn ${severity === s ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setSeverity(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col max-h-[55vh] overflow-y-auto">
          {shown.length === 0 && <p className="text-sm text-[var(--text-muted)] flex items-center gap-2"><Activity size={15} /> Waiting for activity…</p>}
          {shown.map((l) => (
            <div key={l.id} className="log-line">
              <span className="text-[var(--text-dim)] w-20 shrink-0">{clockTime(l.ts)}</span>
              <span className="w-20 shrink-0 font-semibold" style={{ color: SEVERITY_COLOR[l.severity] }}>{l.severity}</span>
              <span className="text-[var(--text-muted)] w-28 shrink-0 truncate">{l.source}</span>
              <span className="flex-1">{l.message}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
