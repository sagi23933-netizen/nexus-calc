/**
 * Governance routes: policies, RBAC, and the human-approval queue.
 */

import { Router } from 'express'
import { z } from 'zod'
import { store } from '../state'
import { approvalsRepo } from '../db/repositories/approvalsRepo'
import { resolveApproval } from '../engine/reviewers'
import { resumeAfterApproval } from '../engine/orchestrator'

export const governanceRouter = Router()

/** GET /api/governance/policies */
governanceRouter.get('/policies', (_req, res) => {
  res.json({ policies: store.policies() })
})

/** PATCH /api/governance/policies/:id — toggle a policy on/off. */
const patchSchema = z.object({ enabled: z.boolean() })
governanceRouter.patch('/policies/:id', (req, res) => {
  const policy = store.policy(req.params.id)
  if (!policy) return res.status(404).json({ error: 'policy not found' })
  const parsed = patchSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid body' })
  policy.enabled = parsed.data.enabled
  store.setPolicy(policy)
  res.json({ policy })
})

/** GET /api/governance/rbac — role-based access control roles. */
governanceRouter.get('/rbac', (_req, res) => {
  res.json({ roles: store.rbacRoles() })
})

/** GET /api/governance/approvals — the approval queue (optionally by status). */
governanceRouter.get('/approvals', (req, res) => {
  const status = req.query.status as 'open' | 'approved' | 'rejected' | undefined
  res.json({ approvals: approvalsRepo.list(status) })
})

/** POST /api/governance/approvals/:id/decide — human approves/rejects. */
const decideSchema = z.object({ approved: z.boolean(), by: z.string().min(1).max(80).optional(), note: z.string().max(500).optional() })
governanceRouter.post('/approvals/:id/decide', async (req, res) => {
  const parsed = decideSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid decision' })
  const req0 = approvalsRepo.get(req.params.id)
  if (!req0) return res.status(404).json({ error: 'approval not found' })
  if (req0.status !== 'open') return res.status(409).json({ error: 'approval already decided' })

  const by = parsed.data.by ?? 'operator'
  const note = parsed.data.note ?? ''
  const updated = resolveApproval(req.params.id, parsed.data.approved, by, note)
  const run = store.run(req0.runId)
  if (run) await resumeAfterApproval(run, parsed.data.approved, by, note)
  res.json({ approval: updated, run })
})
