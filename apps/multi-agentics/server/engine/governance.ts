/**
 * Governance engine — policy evaluation, access control and versioning hooks.
 *
 * Evaluates the enabled policies against a run's current state and returns any
 * violations. The orchestrator consults this before shipping; hard violations
 * force a human-approval gate. Also exposes simple RBAC permission checks used
 * by the routes.
 */

import { store } from '../state'
import { logger } from '../observability/logger'
import type { Policy, Run, Severity } from '@shared/types'

export interface PolicyViolation {
  policyId: string
  name: string
  severity: Severity
  message: string
}

/**
 * Evaluate the active policies against a run. The policy `rule` strings are
 * illustrative DSL; here we implement the meaningful subset directly so the
 * checks actually do something rather than being decorative.
 */
export function evaluatePolicies(run: Run): PolicyViolation[] {
  const violations: PolicyViolation[] = []
  const policies = store.policies().filter((p) => p.enabled)

  for (const p of policies) {
    const v = checkPolicy(p, run)
    if (v) violations.push(v)
  }
  if (violations.length) {
    logger.warn('governance', `${violations.length} policy violation(s) on run ${run.id}: ${violations.map((v) => v.name).join(', ')}`, run.id)
  }
  return violations
}

function checkPolicy(p: Policy, run: Run): PolicyViolation | null {
  switch (p.id) {
    case 'pol_cost':
      if (run.metrics.estimatedCostUsd > 25) {
        return { policyId: p.id, name: p.name, severity: p.severity, message: `Run cost $${run.metrics.estimatedCostUsd.toFixed(2)} exceeds the $25 ceiling.` }
      }
      return null
    case 'pol_tests': {
      const failedTests = store.tasksOfRun(run.id).some((t) => t.gates.some((g) => g.kind === 'tests' && g.outcome === 'fail'))
      if (failedTests) return { policyId: p.id, name: p.name, severity: p.severity, message: 'A test gate failed; production ship is blocked.' }
      return null
    }
    case 'pol_review':
      if (run.goal.priority === 'critical' && !run.requiresApproval) {
        return { policyId: p.id, name: p.name, severity: p.severity, message: 'Critical goal requires a human approval gate.' }
      }
      return null
    case 'pol_secrets': {
      const leaked = store.tasksOfRun(run.id).some((t) =>
        t.gates.some((g) => g.kind === 'security' && g.outcome === 'fail'),
      )
      if (leaked) return { policyId: p.id, name: p.name, severity: p.severity, message: 'Security gate failed — potential secret/vulnerability.' }
      return null
    }
    default:
      return null
  }
}

/** Does any RBAC role grant this permission? (Demo-level check.) */
export function permitted(permission: string): boolean {
  return store.rbacRoles().some((r) => r.permissions.includes('*') || r.permissions.includes(permission))
}

/** Severity → whether it should hard-block shipping. */
export function isBlocking(v: PolicyViolation): boolean {
  return v.severity === 'critical' || v.severity === 'error'
}
