/**
 * Governance & Quality — the human-in-the-loop approval queue, policy controls
 * and RBAC roles. Mirrors the diagram's right "Governance & Control" rail plus
 * the central governance layer.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Check, X, KeyRound, ScrollText } from 'lucide-react'
import { api } from '../api/client'
import { subscribeEvents } from '../api/sse'
import { Card, Pill, SectionTitle } from '../components/ui'
import { timeAgo } from '../lib/format'
import { SEVERITY_COLOR } from '../lib/status'
import type { ApprovalRequest, Policy, RbacRole } from '@shared/types'

export default function GovernancePage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [roles, setRoles] = useState<RbacRole[]>([])

  const loadApprovals = () => void api.approvals('open').then(setApprovals)

  useEffect(() => {
    loadApprovals()
    void api.policies().then(setPolicies)
    void api.rbac().then(setRoles)
    const close = subscribeEvents((event) => {
      if (event.type === 'approval.requested' || event.type === 'approval.resolved') loadApprovals()
    })
    return close
  }, [])

  const decide = async (req: ApprovalRequest, approved: boolean) => {
    await api.decideApproval(req.id, approved, 'operator', approved ? 'Approved from console' : 'Rejected from console')
    setApprovals((prev) => prev.filter((a) => a.id !== req.id))
  }

  const toggle = async (p: Policy) => {
    const updated = await api.togglePolicy(p.id, !p.enabled)
    setPolicies((prev) => prev.map((x) => (x.id === p.id ? updated : x)))
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle title="Governance & Quality" subtitle="Validator agents, review agents and human-in-the-loop approval gates" />

      {/* Approval queue */}
      <Card>
        <div className="flex items-center gap-2 mb-4 font-semibold"><ShieldCheck size={18} className="text-[var(--brand-soft)]" /> Human approval queue ({approvals.length})</div>
        {approvals.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No pending approvals. Critical or flagged runs will pause here for a human decision.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {approvals.map((req) => (
              <div key={req.id} className="card p-4 flex flex-col gap-2" style={{ borderColor: `${SEVERITY_COLOR[req.severity]}55` }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold">{req.title}</div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{req.summary}</p>
                    <p className="text-xs mt-1" style={{ color: SEVERITY_COLOR[req.severity] }}>⚑ {req.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary" onClick={() => decide(req, true)}><Check size={15} /> Approve</button>
                    <button className="btn btn-danger" onClick={() => decide(req, false)}><X size={15} /> Reject</button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text-dim)]">
                  <Link to={`/runs/${req.runId}`} className="hover:text-[var(--brand-soft)] mono">{req.runId}</Link>
                  <span>{timeAgo(req.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)' }}>
        {/* Policies */}
        <Card>
          <div className="flex items-center gap-2 mb-4 font-semibold"><ScrollText size={18} className="text-[var(--node,#3b82f6)]" /> Policies</div>
          <div className="flex flex-col gap-2">
            {policies.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2 border-b border-[var(--line-soft)] last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{p.name}</span>
                    <Pill color={SEVERITY_COLOR[p.severity]}>{p.severity}</Pill>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{p.description}</p>
                  <code className="mono text-[10px] text-[var(--text-dim)]">{p.rule}</code>
                </div>
                <button
                  className="shrink-0 rounded-full transition-colors"
                  style={{ width: 42, height: 24, background: p.enabled ? 'var(--brand)' : '#2a3a5c', position: 'relative' }}
                  onClick={() => toggle(p)}
                  aria-label="toggle policy"
                >
                  <span style={{ position: 'absolute', top: 3, left: p.enabled ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .18s' }} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* RBAC */}
        <Card>
          <div className="flex items-center gap-2 mb-4 font-semibold"><KeyRound size={18} className="text-[#a855f7]" /> Access control (RBAC)</div>
          <div className="flex flex-col gap-3">
            {roles.map((r) => (
              <div key={r.id} className="card p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{r.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{r.memberCount} members</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">{r.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {r.permissions.map((perm) => (
                    <span key={perm} className="mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-muted)]">{perm}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
