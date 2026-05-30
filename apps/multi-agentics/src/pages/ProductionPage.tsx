/**
 * Production — the deployments shipped by completed runs, with environment,
 * version and live URL. Mirrors the diagram's "Production System" node.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Globe, Rocket, ExternalLink } from 'lucide-react'
import { api } from '../api/client'
import { subscribeEvents } from '../api/sse'
import { Card, Pill, SectionTitle, Stat } from '../components/ui'
import { compact, timeAgo } from '../lib/format'
import type { Deployment } from '@shared/types'

const ENV_COLOR: Record<Deployment['environment'], string> = {
  preview: '#5d6f8f',
  staging: '#f59e0b',
  production: '#10b981',
}
const STATUS_COLOR: Record<Deployment['status'], string> = {
  pending: '#5d6f8f',
  building: '#f59e0b',
  live: '#10b981',
  rolled_back: '#a855f7',
  failed: '#ef4444',
}

export default function ProductionPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([])

  const load = () => void api.deployments().then(setDeployments)
  useEffect(() => {
    load()
    const close = subscribeEvents((event) => {
      if (event.type === 'deployment.updated') load()
    })
    return close
  }, [])

  const live = deployments.filter((d) => d.status === 'live').length
  const totalLoc = deployments.reduce((s, d) => s + d.linesOfCode, 0)

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle title="Production System" subtitle="Deployed, monitored, delivered — every shipped run lands here" />

      <div className="grid-cards">
        <Stat label="Live deployments" value={live} accent="#10b981" sub={`${deployments.length} total`} />
        <Stat label="Lines in production" value={compact(totalLoc)} accent="#34d399" sub="across all releases" />
        <Stat label="Latest version" value={deployments[0] ? `v${deployments[0].version}` : '—'} accent="#22d3ee" sub={deployments[0]?.environment ?? ''} />
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-3 font-semibold"><Globe size={18} className="text-[var(--brand-soft)]" /> Deployments</div>
        {deployments.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] flex items-center gap-2"><Rocket size={15} /> No deployments yet — ship a run from Mission Control.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Run</th><th>Environment</th><th>Version</th><th>Status</th><th>LoC</th><th>URL</th><th>When</th></tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr key={d.id}>
                  <td><Link to={`/runs/${d.runId}`} className="mono text-[var(--brand-soft)] hover:underline">{d.runId}</Link></td>
                  <td><Pill color={ENV_COLOR[d.environment]}>{d.environment}</Pill></td>
                  <td className="mono">v{d.version}</td>
                  <td><Pill color={STATUS_COLOR[d.status]}>{d.status}</Pill></td>
                  <td className="mono">{d.linesOfCode.toLocaleString()}</td>
                  <td>
                    <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--brand-soft)] mono text-xs" onClick={(e) => e.preventDefault()}>
                      {d.url.replace('https://', '')} <ExternalLink size={12} />
                    </a>
                  </td>
                  <td className="text-[var(--text-muted)]">{timeAgo(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
