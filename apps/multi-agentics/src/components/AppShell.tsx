/**
 * Application shell: branded sidebar navigation + topbar, and the single global
 * SSE connection that feeds the store. The nav is grouped to echo the diagram —
 * a main column plus the "Observability" and "Governance & Control" rails.
 */

import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import {
  Activity, Boxes, Cpu, FileCode2, GitBranch, Globe, LayoutDashboard,
  Network, ShieldCheck, SlidersHorizontal, Sparkles, Wrench,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useEventStream } from '../api/sse'
import { BRAND } from '@shared/constants'
import { Dot } from './ui'

interface NavItem {
  to: string
  label: string
  icon: typeof Activity
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Orchestration',
    items: [
      { to: '/', label: 'Mission Control', icon: LayoutDashboard },
      { to: '/architecture', label: 'Architecture', icon: Network },
      { to: '/teams', label: 'Teams & Agents', icon: Boxes },
      { to: '/knowledge', label: 'Knowledge Layer', icon: FileCode2 },
      { to: '/tools', label: 'Tools & APIs', icon: Wrench },
    ],
  },
  {
    section: 'Observability',
    items: [
      { to: '/observability', label: 'Logs · Metrics · Traces', icon: Activity },
    ],
  },
  {
    section: 'Governance & Control',
    items: [
      { to: '/governance', label: 'Governance & Quality', icon: ShieldCheck },
      { to: '/mcp', label: 'MCP Servers', icon: Cpu },
      { to: '/production', label: 'Production', icon: Globe },
    ],
  },
]

function ConnectionBadge() {
  const connected = useAppStore((s) => s.connected)
  return (
    <span className="pill" style={{ borderColor: connected ? '#10b98155' : '#ef444455' }}>
      <Dot color={connected ? '#10b981' : '#ef4444'} pulse={connected} />
      {connected ? 'Live' : 'Reconnecting'}
    </span>
  )
}

function ActiveRunBadge() {
  const runs = useAppStore((s) => s.runs)
  const active = runs.filter((r) => !['completed', 'failed', 'cancelled'].includes(r.status))
  if (!active.length) return null
  return (
    <span className="pill" style={{ borderColor: '#22d3ee55', color: '#22d3ee' }}>
      <span className="dot animate-pulse-soft" style={{ background: '#22d3ee' }} />
      {active.length} run{active.length > 1 ? 's' : ''} in flight
    </span>
  )
}

export default function AppShell() {
  const location = useLocation()
  const { ingestEvent, setConnected, refreshSnapshot, refreshRuns } = useAppStore()

  useEventStream((event) => {
    setConnected(true)
    ingestEvent(event)
  })

  useEffect(() => {
    void refreshSnapshot()
    void refreshRuns()
    const t = setInterval(() => void refreshSnapshot(), 12000)
    // Mark connected optimistically; the stream flips it on first event.
    const c = setTimeout(() => setConnected(true), 800)
    return () => {
      clearInterval(t)
      clearTimeout(c)
    }
  }, [refreshSnapshot, refreshRuns, setConnected])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="flex items-center gap-3 px-2 mb-5">
          <div className="grid place-items-center rounded-xl" style={{ width: 38, height: 38, background: 'linear-gradient(180deg,#34d399,#059669)', boxShadow: '0 8px 20px -8px rgba(16,185,129,.7)' }}>
            <Sparkles size={20} color="#04130c" />
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-[15px]">New Level</div>
            <div className="text-[11px] text-[var(--brand-soft)] font-semibold tracking-wide">MULTI-AGENTICS</div>
          </div>
        </div>

        <nav className="flex flex-col">
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="nav-section">{group.section}</div>
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Icon size={17} />
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="mt-6 px-2 text-[11px] text-[var(--text-dim)]">
          <div className="flex items-center gap-2 mb-1">
            <GitBranch size={13} /> v1.0.0
          </div>
          <div>by {BRAND.vendor}</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <SlidersHorizontal size={16} />
            <span className="font-semibold text-[var(--text)]">{titleFor(location.pathname)}</span>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <ActiveRunBadge />
            <ConnectionBadge />
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function titleFor(path: string): string {
  for (const group of NAV) {
    const hit = group.items.find((i) => (i.to === '/' ? path === '/' : path.startsWith(i.to)))
    if (hit) return hit.label
  }
  return BRAND.product
}
