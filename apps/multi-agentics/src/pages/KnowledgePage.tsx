/**
 * Knowledge Layer — semantic search over the vector DB, shared-memory browser
 * and generated-codebase explorer.
 */

import { useEffect, useState } from 'react'
import { Search, Database, FileCode2, Brain } from 'lucide-react'
import { api } from '../api/client'
import { Card, SectionTitle, Spinner } from '../components/ui'
import { timeAgo } from '../lib/format'
import type { CodeArtifact, MemoryEntry, VectorSearchHit } from '@shared/types'

type Tab = 'search' | 'memory' | 'codebase'

export default function KnowledgePage() {
  const [tab, setTab] = useState<Tab>('search')
  const [query, setQuery] = useState('how does parallel scheduling avoid bottlenecks')
  const [hits, setHits] = useState<VectorSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [memory, setMemory] = useState<MemoryEntry[]>([])
  const [artifacts, setArtifacts] = useState<CodeArtifact[]>([])
  const [dim, setDim] = useState(0)

  useEffect(() => {
    void api.memory().then(setMemory)
    void api.artifacts().then(setArtifacts)
    void api.vectors().then((r) => setDim(r.dim))
    void runSearch('how does parallel scheduling avoid bottlenecks')
  }, [])

  const runSearch = async (q: string) => {
    setSearching(true)
    try {
      setHits(await api.search(q, 6))
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle title="Shared Platform & Knowledge Layer" subtitle={`Vector DB (${dim}-dim embeddings) · shared memory · generated codebase`} />

      <div className="flex gap-2">
        <TabBtn active={tab === 'search'} onClick={() => setTab('search')} icon={<Search size={15} />}>Vector search</TabBtn>
        <TabBtn active={tab === 'memory'} onClick={() => setTab('memory')} icon={<Brain size={15} />}>Shared memory</TabBtn>
        <TabBtn active={tab === 'codebase'} onClick={() => setTab('codebase')} icon={<FileCode2 size={15} />}>Codebase</TabBtn>
      </div>

      {tab === 'search' && (
        <Card className="flex flex-col gap-4">
          <div className="flex gap-2">
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch(query)} placeholder="Search the knowledge base…" />
            <button className="btn btn-primary" onClick={() => runSearch(query)} disabled={searching}>
              {searching ? <Spinner size={15} /> : <Search size={16} />} Search
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {hits.map((h) => (
              <div key={h.doc.id} className="card p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{h.doc.title}</span>
                  <span className="mono text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(16,185,129,.14)', color: '#34d399' }}>{(h.score * 100).toFixed(1)}%</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{h.doc.text}</p>
                <div className="flex gap-1 flex-wrap mt-1">
                  {h.doc.tags.map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-muted)]">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'memory' && (
        <Card>
          <div className="flex items-center gap-2 mb-3 text-[var(--text-muted)]"><Database size={16} /> {memory.length} entries</div>
          <table className="tbl">
            <thead>
              <tr><th>Key</th><th>Value</th><th>Scope</th><th>Updated</th></tr>
            </thead>
            <tbody>
              {memory.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.key}</td>
                  <td className="text-[var(--text-muted)]">{m.value}</td>
                  <td><span className="pill" style={{ borderColor: '#1c2a44' }}>{m.scope}</span></td>
                  <td className="text-[var(--text-muted)]">{timeAgo(m.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'codebase' && (
        <Card>
          <div className="flex items-center gap-2 mb-3 text-[var(--text-muted)]">
            <FileCode2 size={16} /> {artifacts.length} files · {artifacts.reduce((s, a) => s + a.lines, 0).toLocaleString()} lines generated
          </div>
          <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
            {artifacts.length === 0 && <p className="text-sm text-[var(--text-muted)]">No artifacts yet — run a build from Mission Control.</p>}
            {artifacts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm py-1.5 px-2 rounded hover:bg-white/5">
                <FileCode2 size={14} className="text-[var(--text-dim)] shrink-0" />
                <span className="mono truncate flex-1">{a.path}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-muted)]">{a.language}</span>
                <span className="text-xs text-[var(--text-muted)] w-16 text-right">{a.lines} ln</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button className={`btn ${active ? 'btn-primary' : 'btn-ghost'}`} onClick={onClick}>
      {icon} {children}
    </button>
  )
}
