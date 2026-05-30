/**
 * Tools & APIs — the provider registry with the auto-configuration flow.
 * Demonstrates the platform "doing what the user can't": one click runs a guided
 * (simulated) provisioning sequence that issues secrets and verifies the link.
 */

import { useEffect, useRef, useState } from 'react'
import { Plug, Check, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import { Card, Pill, SectionTitle, Spinner } from '../components/ui'
import { titleCase } from '../lib/format'
import type { ToolDef } from '@shared/types'

const STATUS_COLOR: Record<ToolDef['status'], string> = {
  unconfigured: '#5d6f8f',
  configuring: '#f59e0b',
  connected: '#10b981',
  error: '#ef4444',
}

export default function ToolsPage() {
  const [tools, setTools] = useState<ToolDef[]>([])
  const [summary, setSummary] = useState({ total: 0, connected: 0 })
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const polling = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const load = async () => {
    const { tools: t, summary: s } = await api.tools()
    setTools(t)
    setSummary(s)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    return () => Object.values(polling.current).forEach(clearInterval)
  }, [])

  const configure = async (tool: ToolDef) => {
    await api.configureTool(tool.id)
    setTools((prev) => prev.map((x) => (x.id === tool.id ? { ...x, status: 'configuring' } : x)))
    // Poll progress until it leaves "configuring".
    polling.current[tool.id] = setInterval(async () => {
      const { tool: updated } = await api.toolProgress(tool.id)
      if (updated) {
        setTools((prev) => prev.map((x) => (x.id === tool.id ? updated : x)))
        if (updated.status !== 'configuring') {
          clearInterval(polling.current[tool.id])
          void load()
        }
      }
    }, 600)
  }

  const disconnect = async (tool: ToolDef) => {
    const updated = await api.disconnectTool(tool.id)
    setTools((prev) => prev.map((x) => (x.id === tool.id ? updated : x)))
    void load()
  }

  if (loading) return <div className="grid place-items-center py-24"><Spinner size={28} /></div>

  const categories = ['all', ...Array.from(new Set(tools.map((t) => t.category)))]
  const shown = filter === 'all' ? tools : tools.filter((t) => t.category === filter)

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle
        title="Tools & APIs"
        subtitle={`${summary.connected}/${summary.total} providers connected · auto-registration drives the setup for you`}
      />

      <div className="flex gap-2 flex-wrap">
        {categories.map((c) => (
          <button key={c} className={`btn ${filter === c ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(c)}>
            {c === 'all' ? 'All' : titleCase(c)}
          </button>
        ))}
      </div>

      <div className="grid-cards">
        {shown.map((tool) => (
          <Card key={tool.id} hover className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold">{tool.name}</div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">{tool.category}</div>
              </div>
              <Pill color={STATUS_COLOR[tool.status]}>{tool.status}</Pill>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-snug flex-1">{tool.description}</p>
            <div className="flex flex-wrap gap-1">
              {tool.requiredSecrets.map((s) => (
                <span key={s} className="mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-muted)]">{s}</span>
              ))}
            </div>
            <div className="flex gap-2">
              {tool.status === 'connected' ? (
                <button className="btn btn-ghost flex-1" onClick={() => disconnect(tool)}>
                  <RefreshCw size={14} /> Disconnect
                </button>
              ) : tool.status === 'configuring' ? (
                <button className="btn btn-ghost flex-1" disabled>
                  <Loader2 size={14} className="animate-spin" /> Provisioning…
                </button>
              ) : (
                <button className="btn btn-primary flex-1" onClick={() => configure(tool)}>
                  {tool.status === 'error' ? <AlertTriangle size={14} /> : <Plug size={14} />}
                  {tool.status === 'error' ? 'Retry' : 'Auto-configure'}
                </button>
              )}
            </div>
            {tool.status === 'connected' && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: '#34d399' }}>
                <Check size={13} /> Verified & ready
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
