/**
 * Review agents + human-approval orchestration.
 *
 * After validation, a reviewer agent gives the run a holistic quality score.
 * If the goal is high-risk (critical priority, low review score, or a policy
 * demands it) a human approval request is raised and the run pauses until a
 * human decides — the "human-in-the-loop" gate from the diagram.
 */

import { nanoid } from 'nanoid'
import { bus } from './eventBus'
import { logger } from '../observability/logger'
import { approvalsRepo } from '../db/repositories/approvalsRepo'
import type { ApprovalRequest, Run, Severity } from '@shared/types'

export interface ReviewResult {
  score: number // 0..100 holistic quality
  summary: string
  requiresHumanApproval: boolean
}

/** Reviewer agent evaluates the assembled run. */
export function reviewRun(run: Run): ReviewResult {
  const m = run.metrics
  const successRatio = m.totalTasks ? m.succeeded / m.totalTasks : 1
  // Blend success ratio with a sampled "craft" score from the reviewer.
  const craft = 78 + Math.floor(Math.random() * 18)
  const score = Math.round(successRatio * 60 + (craft / 100) * 40)

  const reasons: string[] = []
  if (run.goal.priority === 'critical') reasons.push('critical-priority goal')
  if (score < 75) reasons.push('review score below threshold')
  if (m.estimatedCostUsd > 25) reasons.push('cost over budget')
  if (m.failed > 0) reasons.push(`${m.failed} task(s) required remediation`)

  const requiresHumanApproval = reasons.length > 0
  const summary = `Reviewer scored the build ${score}/100 across ${m.totalTasks} tasks (${m.linesOfCode.toLocaleString()} LoC).` +
    (requiresHumanApproval ? ` Human approval requested: ${reasons.join('; ')}.` : ' Auto-approved — no gates triggered.')

  logger.info('reviewers', summary, run.id)
  return { score, summary, requiresHumanApproval }
}

/** Raise a human-approval request for a run and persist it. */
export function requestApproval(run: Run, summary: string, reason: string, severity: Severity = 'notice'): ApprovalRequest {
  const req: ApprovalRequest = {
    id: `appr_${nanoid(8)}`,
    runId: run.id,
    taskId: null,
    title: `Approve shipping: ${run.goal.title}`,
    summary,
    reason,
    severity,
    createdAt: Date.now(),
    status: 'open',
    decidedBy: null,
    decidedAt: null,
    note: null,
  }
  try {
    approvalsRepo.upsert(req)
  } catch {
    /* best effort */
  }
  bus.emit('approval.requested', req, run.id)
  logger.notice('reviewers', `Approval requested for run ${run.id}: ${reason}`, run.id)
  return req
}

/** Record a human decision on an approval request. */
export function resolveApproval(id: string, approved: boolean, by: string, note: string): ApprovalRequest | null {
  const req = approvalsRepo.get(id)
  if (!req || req.status !== 'open') return req
  req.status = approved ? 'approved' : 'rejected'
  req.decidedBy = by
  req.decidedAt = Date.now()
  req.note = note
  approvalsRepo.upsert(req)
  bus.emit('approval.resolved', req, req.runId)
  logger.info('reviewers', `Approval ${req.id} ${req.status} by ${by}`, req.runId)
  return req
}

export const reviewerApi = { reviewRun, requestApproval, resolveApproval }
