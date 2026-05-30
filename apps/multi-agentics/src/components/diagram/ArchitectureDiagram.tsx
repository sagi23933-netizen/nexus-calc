/**
 * Interactive architecture diagram — a faithful, live rendering of the
 * "Monster-Scale Multi-Agent System Architecture" reference image.
 *
 * The `activeStage` prop drives which layer is highlighted and which flow edges
 * animate, so as a run progresses the diagram lights up top-to-bottom exactly
 * like the orchestration it represents.
 */

import type { StageKey, TeamKind } from '@shared/types'
import { TEAM_ACCENTS, TEAM_LABELS, TEAM_ORDER } from '@shared/constants'

interface Props {
  activeStage?: StageKey | null
  /** Optional live counters rendered into relevant nodes. */
  stats?: { agents?: number; teams?: number; loc?: number; tools?: number }
  compact?: boolean
}

const BRAND = '#34d399'
const NODE = '#3b82f6'
const PURPLE = '#a855f7'
const AMBER = '#f59e0b'

/** Order of stages used to decide whether an edge has been "passed". */
const FLOW: StageKey[] = ['goal', 'orchestrator', 'planner', 'supervisors', 'teams', 'knowledge', 'governance', 'production']

function isActive(stage: StageKey, active?: StageKey | null): boolean {
  return active === stage
}
function isReached(stage: StageKey, active?: StageKey | null): boolean {
  if (!active) return false
  return FLOW.indexOf(stage) <= FLOW.indexOf(active)
}

function Box({
  x, y, w, h, title, subtitle, color, active, reached, icon,
}: {
  x: number; y: number; w: number; h: number; title: string; subtitle?: string; color: string; active?: boolean; reached?: boolean; icon?: string
}) {
  const opacity = reached ? 1 : 0.62
  return (
    <g className={`diagram-node ${active ? 'is-active' : ''}`} style={{ opacity }}>
      <rect x={x} y={y} width={w} height={h} rx={11} fill="rgba(15,26,46,0.92)" stroke={active ? color : `${color}66`} strokeWidth={active ? 2 : 1.25} />
      <rect x={x} y={y} width={4} height={h} rx={2} fill={color} />
      {icon && (
        <text x={x + 16} y={y + h / 2 + 5} fontSize={15}>
          {icon}
        </text>
      )}
      <text x={x + (icon ? 36 : 16)} y={subtitle ? y + h / 2 - 2 : y + h / 2 + 4} fill="#e6edf6" fontSize={13} fontWeight={700}>
        {title}
      </text>
      {subtitle && (
        <text x={x + (icon ? 36 : 16)} y={y + h / 2 + 14} fill="#93a4c0" fontSize={10.5}>
          {subtitle}
        </text>
      )}
    </g>
  )
}

function Edge({ d, active, reached, color = BRAND }: { d: string; active?: boolean; reached?: boolean; color?: string }) {
  return <path d={d} fill="none" stroke={reached ? color : '#2a3a5c'} strokeWidth={1.6} className={`flow-edge ${active ? 'is-active' : ''}`} style={{ opacity: reached ? 0.9 : 0.5 }} />
}

export default function ArchitectureDiagram({ activeStage, stats, compact }: Props) {
  const a = activeStage ?? null
  const cx = 520 // center x
  const teamW = 60
  const teamGap = 6
  const teamsTotalW = TEAM_ORDER.length * teamW + (TEAM_ORDER.length - 1) * teamGap
  const teamsStartX = cx - teamsTotalW / 2

  return (
    <svg viewBox="0 0 1040 768" width="100%" height={compact ? 420 : '100%'} style={{ minHeight: compact ? 360 : 600 }} role="img" aria-label="Multi-agent system architecture">
      {/* ---- Center flow edges ---- */}
      <Edge d={`M ${cx} 66 L ${cx} 92`} active={isActive('orchestrator', a)} reached={isReached('orchestrator', a)} />
      <Edge d={`M ${cx} 132 L ${cx} 158`} active={isActive('planner', a)} reached={isReached('planner', a)} />
      <Edge d={`M ${cx} 198 L ${cx} 224`} active={isActive('supervisors', a)} reached={isReached('supervisors', a)} />
      <Edge d={`M ${cx} 264 L ${cx} 292`} active={isActive('teams', a)} reached={isReached('teams', a)} />
      <Edge d={`M ${cx} 350 L ${cx} 388`} active={isActive('knowledge', a)} reached={isReached('knowledge', a)} />
      <Edge d={`M ${cx} 470 L ${cx} 500`} active={isActive('governance', a)} reached={isReached('governance', a)} />
      <Edge d={`M ${cx} 590 L ${cx} 620`} active={isActive('production', a)} reached={isReached('production', a)} />

      {/* ---- Goal ---- */}
      <Box x={cx - 150} y={20} w={300} h={46} title="User / Product Goal" subtitle="Describe what to build" color={BRAND} icon="🎯" active={isActive('goal', a)} reached={isReached('goal', a)} />

      {/* ---- Master Orchestrator ---- */}
      <Box x={cx - 150} y={86} w={300} h={46} title="Master Orchestrator" subtitle="Owns the run lifecycle" color={NODE} icon="🧠" active={isActive('orchestrator', a)} reached={isReached('orchestrator', a)} />

      {/* ---- Task Decomposer + Planner ---- */}
      <Box x={cx - 150} y={152} w={300} h={46} title="Task Decomposer + Planner" subtitle="Builds the task DAG" color={NODE} icon="🗂️" active={isActive('planner', a)} reached={isReached('planner', a)} />

      {/* ---- Team Supervisors ---- */}
      <Box x={cx - 150} y={218} w={300} h={46} title="Team Supervisors" subtitle={`${stats?.teams ?? 10} supervisors`} color={NODE} icon="👥" active={isActive('supervisors', a)} reached={isReached('supervisors', a)} />

      {/* ---- Teams row ---- */}
      <g className={`diagram-node ${isActive('teams', a) ? 'is-active' : ''}`} style={{ opacity: isReached('teams', a) ? 1 : 0.62 }}>
        {TEAM_ORDER.map((kind, i) => {
          const x = teamsStartX + i * (teamW + teamGap)
          const color = TEAM_ACCENTS[kind as TeamKind]
          return (
            <g key={kind}>
              <rect x={x} y={292} width={teamW} height={48} rx={8} fill="rgba(15,26,46,0.92)" stroke={`${color}88`} strokeWidth={1.2} />
              <rect x={x} y={292} width={teamW} height={3} rx={1.5} fill={color} />
              <text x={x + teamW / 2} y={312} textAnchor="middle" fill="#e6edf6" fontSize={9.5} fontWeight={700}>
                {shortTeam(kind)}
              </text>
              <text x={x + teamW / 2} y={326} textAnchor="middle" fill="#93a4c0" fontSize={8}>
                10–20 ◆
              </text>
            </g>
          )
        })}
        <text x={cx} y={356} textAnchor="middle" fill="#5d6f8f" fontSize={10}>
          Up to 10 teams · {stats?.agents ?? 100}+ specialized agents
        </text>
      </g>

      {/* ---- Knowledge layer panel ---- */}
      <KnowledgePanel cx={cx} active={isActive('knowledge', a)} reached={isReached('knowledge', a)} tools={stats?.tools} />

      {/* ---- Governance & Quality panel ---- */}
      <GovernancePanel cx={cx} active={isActive('governance', a)} reached={isReached('governance', a)} />

      {/* ---- Production ---- */}
      <Box x={cx - 150} y={620} w={300} h={48} title="Production System" subtitle={stats?.loc ? `${stats.loc.toLocaleString()} LoC shipped` : 'Deployed, monitored, delivered'} color={BRAND} icon="🚀" active={isActive('production', a)} reached={isReached('production', a)} />

      {/* ---- Left rail: Observability ---- */}
      <Rail x={20} title="Observability" color={NODE} items={['Logs', 'Metrics', 'Tracing']} />

      {/* ---- Right rail: Governance & Control ---- */}
      <Rail x={896} title="Governance & Control" color={PURPLE} items={['Policies', 'Access Control', 'Versioning']} />

      {/* ---- Footer tags ---- */}
      <text x={cx} y={748} textAnchor="middle" fill="#5d6f8f" fontSize={10.5}>
        Scalable hierarchical orchestration · Parallel execution · Validation gates · Human-in-the-loop
      </text>
    </svg>
  )
}

function KnowledgePanel({ cx, active, reached, tools }: { cx: number; active?: boolean; reached?: boolean; tools?: number }) {
  const items = [
    { t: 'Shared Memory', i: '🗄️', c: NODE },
    { t: 'Vector DB', i: '🔎', c: PURPLE },
    { t: 'Codebase', i: '📦', c: BRAND },
    { t: `Tools & APIs${tools ? ` (${tools})` : ''}`, i: '🔧', c: AMBER },
  ]
  const w = 150
  const gap = 12
  const totalW = items.length * w + (items.length - 1) * gap
  const startX = cx - totalW / 2
  return (
    <g className={`diagram-node ${active ? 'is-active' : ''}`} style={{ opacity: reached ? 1 : 0.62 }}>
      <rect x={startX - 14} y={372} width={totalW + 28} height={84} rx={12} fill="rgba(10,17,32,0.6)" stroke="#1c2a44" />
      <text x={startX} y={388} fill="#93a4c0" fontSize={10} fontWeight={700}>
        SHARED PLATFORM &amp; KNOWLEDGE LAYER
      </text>
      {items.map((it, i) => {
        const x = startX + i * (w + gap)
        return (
          <g key={it.t}>
            <rect x={x} y={398} width={w} height={44} rx={9} fill="rgba(15,26,46,0.95)" stroke={`${it.c}77`} />
            <rect x={x} y={398} width={3.5} height={44} rx={2} fill={it.c} />
            <text x={x + 14} y={425} fontSize={14}>
              {it.i}
            </text>
            <text x={x + 36} y={424} fill="#e6edf6" fontSize={11.5} fontWeight={600}>
              {it.t}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function GovernancePanel({ cx, active, reached }: { cx: number; active?: boolean; reached?: boolean }) {
  const items = [
    { t: 'Validator Agents', i: '🛡️', c: BRAND },
    { t: 'Review Agents', i: '🔍', c: NODE },
    { t: 'Human Approval', i: '✅', c: AMBER },
  ]
  const w = 200
  const gap = 12
  const totalW = items.length * w + (items.length - 1) * gap
  const startX = cx - totalW / 2
  return (
    <g className={`diagram-node ${active ? 'is-active' : ''}`} style={{ opacity: reached ? 1 : 0.62 }}>
      <rect x={startX - 14} y={486} width={totalW + 28} height={86} rx={12} fill="rgba(10,17,32,0.6)" stroke="#1c2a44" />
      <text x={startX} y={503} fill="#93a4c0" fontSize={10} fontWeight={700}>
        GOVERNANCE &amp; QUALITY LAYER
      </text>
      {items.map((it, i) => {
        const x = startX + i * (w + gap)
        return (
          <g key={it.t}>
            <rect x={x} y={514} width={w} height={44} rx={9} fill="rgba(15,26,46,0.95)" stroke={`${it.c}77`} />
            <rect x={x} y={514} width={3.5} height={44} rx={2} fill={it.c} />
            <text x={x + 16} y={541} fontSize={14}>
              {it.i}
            </text>
            <text x={x + 40} y={540} fill="#e6edf6" fontSize={12} fontWeight={600}>
              {it.t}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function Rail({ x, title, color, items }: { x: number; title: string; color: string; items: string[] }) {
  return (
    <g style={{ opacity: 0.92 }}>
      <rect x={x} y={120} width={124} height={300} rx={12} fill="rgba(10,17,32,0.55)" stroke="#1c2a44" />
      <text x={x + 62} y={144} textAnchor="middle" fill={color} fontSize={11} fontWeight={800}>
        {title.length > 16 ? title.split(' ')[0] : title}
      </text>
      {title.includes(' ') && title.length > 16 && (
        <text x={x + 62} y={158} textAnchor="middle" fill={color} fontSize={11} fontWeight={800}>
          {title.split(' ').slice(1).join(' ')}
        </text>
      )}
      {items.map((it, i) => {
        const y = 180 + i * 70
        return (
          <g key={it}>
            <rect x={x + 14} y={y} width={96} height={52} rx={9} fill="rgba(15,26,46,0.95)" stroke={`${color}55`} />
            <text x={x + 62} y={y + 31} textAnchor="middle" fill="#e6edf6" fontSize={11} fontWeight={600}>
              {it}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function shortTeam(kind: string): string {
  const label = TEAM_LABELS[kind as TeamKind] ?? kind
  return label.replace(/ Team$| & .*$/i, '').slice(0, 8)
}
