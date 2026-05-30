/**
 * MCP Servers — shows the in-process Model Context Protocol server and the tools
 * it exposes, plus the config snippet to register it with an MCP client.
 */

import { useEffect, useState } from 'react'
import { Cpu, Terminal, Copy, Check } from 'lucide-react'
import { api } from '../api/client'
import { Card, Pill, SectionTitle } from '../components/ui'
import { HEALTH_COLOR } from '../lib/status'
import type { McpServerInfo, McpToolInfo } from '@shared/types'

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "new-level-multi-agentics": {
      "command": "npx",
      "args": ["tsx", "server/mcp/server.ts"],
      "cwd": "apps/multi-agentics"
    }
  }
}`

export default function McpPage() {
  const [servers, setServers] = useState<McpServerInfo[]>([])
  const [tools, setTools] = useState<McpToolInfo[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void api.mcpServers().then(setServers)
    void api.mcpTools().then(setTools)
  }, [])

  const copy = () => {
    navigator.clipboard?.writeText(CONFIG_SNIPPET)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle title="MCP Servers" subtitle="Expose the orchestration engine over the Model Context Protocol" />

      <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        {servers.map((s) => (
          <Card key={s.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu size={18} className="text-[var(--brand-soft)]" />
                <span className="font-bold">{s.name}</span>
              </div>
              <Pill color={HEALTH_COLOR[s.status]}>{s.status}</Pill>
            </div>
            <p className="text-sm text-[var(--text-muted)]">{s.description}</p>
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="pill" style={{ borderColor: '#1c2a44' }}><Terminal size={12} /> {s.transport}</span>
              <span>{s.toolCount} tools</span>
            </div>
          </Card>
        ))}

        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-bold">Register with a client</span>
            <button className="btn btn-ghost" style={{ padding: '5px 10px' }} onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">Add to <code className="mono">claude_desktop_config.json</code> (or run <code className="mono">npm run mcp</code>):</p>
          <pre className="mono text-xs p-3 rounded-lg overflow-x-auto" style={{ background: 'rgba(6,11,22,.7)', border: '1px solid var(--line)' }}>{CONFIG_SNIPPET}</pre>
        </Card>
      </div>

      <Card>
        <h3 className="font-bold mb-3">Exposed tools ({tools.length})</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {tools.map((t) => (
            <div key={t.name} className="card p-3 flex flex-col gap-1.5">
              <span className="mono font-semibold text-sm text-[var(--brand-soft)]">{t.name}</span>
              <p className="text-xs text-[var(--text-muted)]">{t.description}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.keys((t.inputSchema as { properties?: Record<string, unknown> }).properties ?? {}).map((p) => (
                  <span key={p} className="mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-muted)]">{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
