/**
 * Teams & Agents — browse the 10 specialized teams and their agent rosters,
 * with live status, skills and lifetime stats.
 */

import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { api, type TeamWithRoster } from '../api/client'
import { subscribeEvents } from '../api/sse'
import { Card, Pill, SectionTitle, Spinner } from '../components/ui'
import { HEALTH_COLOR } from '../lib/status'
import { compact } from '../lib/format'
import type { Agent } from '@shared/types'

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithRoster[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    void api.listTeams().then((t) => {
      setTeams(t)
      setOpen(t[0]?.id ?? null)
      setLoading(false)
    })
    // Refresh on agent updates so statuses stay live.
    const close = subscribeEvents((event) => {
      if (event.type === 'agent.updated') {
        const agent = event.payload as Agent
        setTeams((prev) =>
          prev.map((tm) =>
            tm.id === agent.teamId
              ? { ...tm, agents: tm.agents.map((x) => (x.id === agent.id ? agent : x)) }
              : tm,
          ),
        )
      }
    })
    return close
  }, [])

  if (loading) return <div className="grid place-items-center py-24"><Spinner size={28} /></div>

  const totalAgents = teams.reduce((s, t) => s + t.agents.length + 1, 0)

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle title="Teams & Agents" subtitle={`${teams.length} teams · ${totalAgents} agents including supervisors`} />
      <div className="grid-cards">
        {teams.map((team) => {
          const busy = team.agents.filter((a) => a.status === 'busy').length
          return (
            <Card key={team.id} hover className="cursor-pointer flex flex-col gap-3" onClick={() => setOpen(open === team.id ? null : team.id)}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: team.accent, boxShadow: `0 0 10px ${team.accent}` }} />
                <span className="font-bold">{team.name}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-snug">{team.mission}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">{team.agents.length + 1} agents</span>
                <Pill color={busy ? '#22d3ee' : team.accent}>{busy ? `${busy} busy` : 'idle'}</Pill>
              </div>
            </Card>
          )
        })}
      </div>

      {open && (() => {
        const team = teams.find((t) => t.id === open)!
        return (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Users size={18} style={{ color: team.accent }} />
              <h3 className="font-bold">{team.name} roster</h3>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {team.supervisor && <AgentCard agent={team.supervisor} accent={team.accent} lead />}
              {team.agents.map((a) => (
                <AgentCard key={a.id} agent={a} accent={team.accent} />
              ))}
            </div>
          </Card>
        )
      })()}
    </div>
  )
}

function AgentCard({ agent, accent, lead }: { agent: Agent; accent: string; lead?: boolean }) {
  const color = HEALTH_COLOR[agent.status]
  return (
    <div className="card p-3 flex flex-col gap-2" style={{ borderColor: lead ? `${accent}66` : undefined }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`dot ${agent.status === 'busy' ? 'animate-pulse-soft' : ''}`} style={{ background: color }} />
          <span className="font-semibold text-sm">{agent.name}</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${accent}22`, color: accent }}>{lead ? 'supervisor' : agent.role}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {agent.skills.slice(0, 3).map((s) => (
          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-muted)]">{s}</span>
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mono">
        <span>✓ {agent.stats.tasksCompleted}</span>
        <span>{compact(agent.stats.tokensUsed)} tok</span>
        <span>{Math.round(agent.stats.successRate * 100)}%</span>
      </div>
    </div>
  )
}
