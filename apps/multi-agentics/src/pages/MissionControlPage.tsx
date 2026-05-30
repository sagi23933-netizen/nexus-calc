/**
 * Mission Control — submit a product goal and watch the platform build it.
 * Combines the goal form, the live architecture diagram (driven by the active
 * run's stage), platform stats and the recent-runs list.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Rocket, X } from 'lucide-react'
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import ArchitectureDiagram from '../components/diagram/ArchitectureDiagram'
import { Card, Pill, ProgressBar, SectionTitle, Spinner, Stat } from '../components/ui'
import { compact, fullNumber, timeAgo } from '../lib/format'
import { runStatusColor } from '../lib/status'
import { STAGE_LABELS } from '@shared/constants'
import type { Run } from '@shared/types'

const PRIORITIES = ['low', 'normal', 'high', 'critical'] as const

export default function MissionControlPage() {
  const navigate = useNavigate()
  const { snapshot, runs, refreshRuns, refreshSnapshot } = useAppStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('normal')
  const [stack, setStack] = useState<string[]>(['typescript', 'react', 'node'])
  const [stackInput, setStackInput] = useState('')
  const [constraints, setConstraints] = useState<string[]>([])
  const [constraintInput, setConstraintInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void refreshRuns()
    void refreshSnapshot()
  }, [refreshRuns, refreshSnapshot])

  // The most recently active run drives the live diagram.
  const focusRun: Run | undefined = useMemo(() => {
    const active = runs.find((r) => !['completed', 'failed', 'cancelled'].includes(r.status))
    return active ?? runs[0]
  }, [runs])

  const submit = async () => {
    if (title.trim().length < 3 || description.trim().length < 3) {
      setError('Give the goal a title and a description (3+ characters).')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { runId } = await api.submitGoal({ title, description, stack, constraints, priority })
      setTitle('')
      setDescription('')
      setConstraints([])
      await refreshRuns()
      navigate(`/runs/${runId}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const addTag = (val: string, list: string[], setList: (v: string[]) => void, clear: () => void) => {
    const v = val.trim().toLowerCase()
    if (v && !list.includes(v)) setList([...list, v])
    clear()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid-cards">
        <Stat label="Agents" value={snapshot ? snapshot.agents.total : '—'} sub={snapshot ? `${snapshot.agents.idle} idle · ${snapshot.agents.active} busy` : ''} />
        <Stat label="Teams" value={snapshot?.teams ?? '—'} accent="#22d3ee" sub="specialized squads" />
        <Stat label="Lines shipped" value={snapshot ? compact(snapshot.totals.linesOfCode) : '—'} accent="#34d399" sub={snapshot ? `${fullNumber(snapshot.totals.filesGenerated)} files` : ''} />
        <Stat label="Deployments" value={snapshot?.deployments.live ?? '—'} accent="#f59e0b" sub="live in production" />
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1.35fr)' }}>
        {/* Goal form */}
        <Card className="flex flex-col gap-4 h-fit">
          <SectionTitle title="New build" subtitle="Describe a product goal — the orchestrator does the rest." />
          <div>
            <label className="label">Goal title</label>
            <input className="input" value={title} placeholder="e.g. Realtime analytics dashboard" onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="textarea" value={description} placeholder="What should the system do? Include key features, scale and any constraints…" onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Priority</label>
              <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Add stack</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={stackInput}
                  placeholder="python…"
                  onChange={(e) => setStackInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag(stackInput, stack, setStack, () => setStackInput(''))}
                />
                <button className="btn btn-ghost" onClick={() => addTag(stackInput, stack, setStack, () => setStackInput(''))}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
          <TagRow tags={stack} onRemove={(t) => setStack(stack.filter((x) => x !== t))} />

          <div>
            <label className="label">Constraints (optional)</label>
            <div className="flex gap-2">
              <input
                className="input"
                value={constraintInput}
                placeholder="e.g. GDPR compliant, < 200ms latency…"
                onChange={(e) => setConstraintInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag(constraintInput, constraints, setConstraints, () => setConstraintInput(''))}
              />
              <button className="btn btn-ghost" onClick={() => addTag(constraintInput, constraints, setConstraints, () => setConstraintInput(''))}>
                <Plus size={16} />
              </button>
            </div>
          </div>
          {constraints.length > 0 && <TagRow tags={constraints} onRemove={(t) => setConstraints(constraints.filter((x) => x !== t))} />}

          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? <Spinner size={16} /> : <Rocket size={17} />}
            Launch autonomous build
          </button>
        </Card>

        {/* Live diagram */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-bold">Live architecture</h3>
              <p className="text-xs text-[var(--text-muted)]">
                {focusRun ? `${focusRun.goal.title} · ${STAGE_LABELS[focusRun.activeStage]}` : 'Submit a goal to watch the flow light up'}
              </p>
            </div>
            {focusRun && <Pill color={runStatusColor(focusRun.status)}>{focusRun.status.replace('_', ' ')}</Pill>}
          </div>
          {focusRun && <ProgressBar value={focusRun.progress} color={runStatusColor(focusRun.status)} />}
          <div className="flex-1 mt-2 overflow-hidden">
            <ArchitectureDiagram
              activeStage={focusRun?.activeStage ?? null}
              stats={{ agents: snapshot?.agents.total, teams: snapshot?.teams, loc: focusRun?.metrics.linesOfCode, tools: snapshot?.tools.connected }}
            />
          </div>
        </Card>
      </div>

      {/* Recent runs */}
      <div>
        <SectionTitle title="Recent runs" subtitle="Click a run to inspect its task DAG, agents and artifacts." />
        {runs.length === 0 ? (
          <Card className="text-sm text-[var(--text-muted)]">No runs yet — launch your first build above.</Card>
        ) : (
          <div className="grid-cards">
            {runs.slice(0, 9).map((run) => (
              <Card key={run.id} hover className="cursor-pointer flex flex-col gap-3" >
                <div onClick={() => navigate(`/runs/${run.id}`)} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold leading-tight">{run.goal.title}</span>
                    <Pill color={runStatusColor(run.status)}>{run.status.replace('_', ' ')}</Pill>
                  </div>
                  <ProgressBar value={run.progress} color={runStatusColor(run.status)} />
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>{compact(run.metrics.linesOfCode)} LoC · {run.metrics.totalTasks} tasks</span>
                    <span>{timeAgo(run.createdAt)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TagRow({ tags, onRemove }: { tags: string[]; onRemove: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <span key={t} className="pill" style={{ borderColor: '#1c2a44' }}>
          {t}
          <X size={13} className="cursor-pointer opacity-60 hover:opacity-100" onClick={() => onRemove(t)} />
        </span>
      ))}
    </div>
  )
}
