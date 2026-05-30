/**
 * Run detail — the live cockpit for a single run: architecture flow, metrics,
 * the task DAG (grouped by depth), generated artifacts and a streaming log.
 * Subscribes to the run-scoped SSE channel for real-time updates.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Ban, FileCode2 } from 'lucide-react'
import { api } from '../api/client'
import { subscribeEvents } from '../api/sse'
import ArchitectureDiagram from '../components/diagram/ArchitectureDiagram'
import { Card, Pill, ProgressBar, SectionTitle, Spinner } from '../components/ui'
import { clockTime, compact, duration, fullNumber } from '../lib/format'
import { runStatusColor, taskStatusColor, SEVERITY_COLOR } from '../lib/status'
import { STAGE_LABELS, TEAM_ACCENTS } from '@shared/constants'
import type { CodeArtifact, EngineEvent, LogEntry, Run, Task, TeamKind } from '@shared/types'

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [run, setRun] = useState<Run | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [artifacts, setArtifacts] = useState<CodeArtifact[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [r, t, a] = await Promise.all([api.getRun(id), api.getTasks(id), api.getArtifacts(id)])
      setRun(r)
      setTasks(t)
      setArtifacts(a)
    } catch {
      /* run may not exist yet */
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  // Live updates for this run.
  useEffect(() => {
    if (!id) return
    const close = subscribeEvents((event: EngineEvent) => {
      if (event.type === 'run.updated' || event.type === 'run.stage' || event.type === 'run.completed') {
        if (event.type === 'run.stage') {
          setRun((prev) => (prev ? { ...prev, status: (event.payload as { status: Run['status'] }).status, activeStage: (event.payload as { stage: Run['activeStage'] }).stage } : prev))
        } else {
          setRun(event.payload as Run)
        }
      }
      if (event.type === 'task.updated' || event.type === 'task.created') {
        const task = event.payload as Task
        setTasks((prev) => {
          const idx = prev.findIndex((x) => x.id === task.id)
          if (idx >= 0) {
            const next = prev.slice()
            next[idx] = task
            return next
          }
          return [...prev, task]
        })
        if (task.status === 'succeeded') void api.getArtifacts(id).then(setArtifacts)
      }
      if (event.type === 'log') {
        setLogs((prev) => [event.payload as LogEntry, ...prev].slice(0, 120))
      }
    }, id)
    return close
  }, [id])

  const grouped = useMemo(() => groupByDepth(tasks), [tasks])

  if (loading) return <div className="grid place-items-center py-24"><Spinner size={28} /></div>
  if (!run) return <Card>Run not found. <Link className="text-[var(--brand-soft)]" to="/">Back to Mission Control</Link></Card>

  const m = run.metrics
  const isActive = !['completed', 'failed', 'cancelled'].includes(run.status)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{run.goal.title}</h1>
          <p className="text-sm text-[var(--text-muted)]">{STAGE_LABELS[run.activeStage]} · {run.goal.priority} priority</p>
        </div>
        <Pill color={runStatusColor(run.status)}>{run.status.replace('_', ' ')}</Pill>
        {isActive && (
          <button className="btn btn-danger" onClick={() => api.cancelRun(run.id).then(setRun)}>
            <Ban size={15} /> Cancel
          </button>
        )}
      </div>

      <ProgressBar value={run.progress} color={runStatusColor(run.status)} />

      {/* Metrics */}
      <div className="grid-cards">
        <MetricCard label="Tasks" value={`${m.succeeded}/${m.totalTasks}`} sub={`${m.failed} failed`} />
        <MetricCard label="Lines of code" value={compact(m.linesOfCode)} sub={`${m.filesGenerated} files`} accent="#34d399" />
        <MetricCard label="Tokens" value={compact(m.tokensUsed)} sub={`$${m.estimatedCostUsd.toFixed(2)} est.`} accent="#22d3ee" />
        <MetricCard label="Parallel peak" value={String(m.parallelPeak)} sub="agents at once" accent="#a855f7" />
        <MetricCard label="Critical path" value={duration(m.criticalPathMs)} sub="lower bound" accent="#f59e0b" />
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)' }}>
        {/* Task DAG */}
        <Card>
          <SectionTitle title="Task DAG" subtitle="Layers execute left→right; tasks within a layer run in parallel." />
          <div className="flex gap-4 overflow-x-auto pb-2">
            {grouped.map((layer, depth) => (
              <div key={depth} className="flex flex-col gap-2 min-w-[180px]">
                <div className="text-[11px] uppercase tracking-wide text-[var(--text-dim)] font-semibold">Layer {depth}</div>
                {layer.map((task) => (
                  <TaskNode key={task.id} task={task} />
                ))}
              </div>
            ))}
          </div>
        </Card>

        {/* Live diagram */}
        <Card className="flex flex-col">
          <h3 className="font-bold mb-1">Architecture flow</h3>
          <ArchitectureDiagram compact activeStage={run.activeStage} stats={{ loc: m.linesOfCode }} />
        </Card>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        {/* Artifacts */}
        <Card>
          <SectionTitle title={`Generated codebase (${artifacts.length})`} subtitle={`${fullNumber(artifacts.reduce((s, a) => s + a.lines, 0))} lines across the run`} />
          <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
            {artifacts.length === 0 && <p className="text-sm text-[var(--text-muted)]">Artifacts appear as tasks complete…</p>}
            {artifacts.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-white/5">
                <FileCode2 size={15} className="text-[var(--text-dim)] shrink-0" />
                <span className="mono truncate flex-1">{a.path}</span>
                <span className="text-xs text-[var(--text-muted)]">{a.lines} ln</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Live log */}
        <Card>
          <SectionTitle title="Live log" subtitle="Streaming over SSE" />
          <div className="flex flex-col max-h-80 overflow-y-auto">
            {logs.length === 0 && <p className="text-sm text-[var(--text-muted)]">Waiting for activity…</p>}
            {logs.map((l) => (
              <div key={l.id} className="log-line">
                <span className="text-[var(--text-dim)]">{clockTime(l.ts)}</span>
                <span style={{ color: SEVERITY_COLOR[l.severity] }}>{l.source}</span>
                <span className="text-[var(--text)] flex-1">{l.message}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, accent = 'var(--text)' }: { label: string; value: string; sub: string; accent?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      <span className="text-2xl font-bold" style={{ color: accent }}>{value}</span>
      <span className="text-xs text-[var(--text-muted)]">{sub}</span>
    </Card>
  )
}

function TaskNode({ task }: { task: Task }) {
  const color = taskStatusColor(task.status)
  const accent = TEAM_ACCENTS[task.teamKind as TeamKind]
  const running = task.status === 'running' || task.status === 'validating'
  return (
    <div className="card p-3 flex flex-col gap-1.5" style={{ borderColor: `${color}66` }}>
      <div className="flex items-center gap-2">
        <span className={`dot ${running ? 'animate-pulse-soft' : ''}`} style={{ background: color }} />
        <span className="text-[13px] font-semibold leading-tight flex-1">{task.title}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${accent}22`, color: accent }}>{task.teamKind}</span>
        <span className="text-[10px]" style={{ color }}>{task.status}{task.attempts > 1 ? ` ·${task.attempts}` : ''}</span>
      </div>
    </div>
  )
}

function groupByDepth(tasks: Task[]): Task[][] {
  const max = tasks.reduce((m, t) => Math.max(m, t.depth), 0)
  const layers: Task[][] = Array.from({ length: max + 1 }, () => [])
  for (const t of tasks) layers[t.depth]?.push(t)
  return layers
}
