/**
 * Architecture page — the full interactive diagram plus an annotated legend
 * explaining each layer, mirroring the reference image's structure.
 */

import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import ArchitectureDiagram from '../components/diagram/ArchitectureDiagram'
import { Card, SectionTitle } from '../components/ui'
import { BRAND } from '@shared/constants'

const LAYERS = [
  { name: 'Master Orchestrator', desc: 'Owns the run lifecycle state machine and routes work top-to-bottom.', color: '#3b82f6' },
  { name: 'Task Decomposer + Planner', desc: 'Breaks the goal into a task DAG with dependencies and a critical path.', color: '#3b82f6' },
  { name: 'Team Supervisors', desc: 'One supervisor per specialization coordinates its agent roster.', color: '#3b82f6' },
  { name: 'Agent Teams', desc: 'Up to 10 teams of 10–20 agents execute tasks in parallel.', color: '#22d3ee' },
  { name: 'Knowledge Layer', desc: 'Shared memory, vector DB, the generated codebase and the tools registry.', color: '#a855f7' },
  { name: 'Governance & Quality', desc: 'Validator agents, review agents and human-in-the-loop approval gates.', color: '#10b981' },
  { name: 'Production', desc: 'Versioned, validated builds shipped to a live environment.', color: '#34d399' },
]

export default function ArchitecturePage() {
  const runs = useAppStore((s) => s.runs)
  const snapshot = useAppStore((s) => s.snapshot)
  const focus = useMemo(() => runs.find((r) => !['completed', 'failed', 'cancelled'].includes(r.status)) ?? runs[0], [runs])

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle title={BRAND.tagline} subtitle={BRAND.subtitle} />
      <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 2.1fr) minmax(0, 1fr)' }}>
        <Card className="overflow-hidden">
          <ArchitectureDiagram
            activeStage={focus?.activeStage ?? null}
            stats={{ agents: snapshot?.agents.total, teams: snapshot?.teams, loc: focus?.metrics.linesOfCode, tools: snapshot?.tools.connected }}
          />
        </Card>
        <div className="flex flex-col gap-3">
          <Card>
            <h3 className="font-bold mb-1">How it flows</h3>
            <p className="text-sm text-[var(--text-muted)]">A product goal enters at the top and cascades through orchestration, planning, parallel agent execution, the shared knowledge layer and governance gates before shipping to production.</p>
          </Card>
          {LAYERS.map((l) => (
            <Card key={l.name} hover className="flex gap-3">
              <span className="w-1 rounded-full shrink-0" style={{ background: l.color }} />
              <div>
                <div className="font-semibold text-sm" style={{ color: l.color }}>{l.name}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{l.desc}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
