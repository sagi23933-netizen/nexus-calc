/**
 * Validator agents — the automated quality gates.
 *
 * After a task produces artifacts, it passes through a battery of validators
 * (schema, lint, security, tests, cost). Each returns a QualityGate with a
 * pass/fail outcome and a score. A failing hard gate sends the task back for
 * remediation (handled by the scheduler); soft gates only warn.
 */

import { nanoid } from 'nanoid'
import { store } from '../state'
import { bus } from './eventBus'
import { logger } from '../observability/logger'
import type { ExecResult } from './agentSimulator'
import type { GateKind, QualityGate, Run, Task } from '@shared/types'

interface ValidatorDef {
  kind: GateKind
  label: string
  /** Hard gates block the task; soft gates only annotate. */
  hard: boolean
  /** Returns a score 0..100 and a message. */
  evaluate: (run: Run, task: Task, result: ExecResult) => { score: number; message: string }
}

const VALIDATORS: ValidatorDef[] = [
  {
    kind: 'schema',
    label: 'Schema & contract check',
    hard: true,
    evaluate: (_r, _t, res) => {
      const score = res.artifacts.length > 0 ? 88 + Math.floor(Math.random() * 12) : 40
      return { score, message: res.artifacts.length ? 'Interfaces conform to declared contracts.' : 'No artifacts produced to validate.' }
    },
  },
  {
    kind: 'lint',
    label: 'Lint & style',
    hard: false,
    evaluate: () => {
      const score = 80 + Math.floor(Math.random() * 20)
      return { score, message: score > 90 ? 'Clean — no style violations.' : 'Minor style warnings auto-fixed.' }
    },
  },
  {
    kind: 'security',
    label: 'Security scan',
    hard: true,
    evaluate: (_r, task) => {
      // Security-team tasks get a higher baseline; others sampled.
      const baseline = task.teamKind === 'security' ? 95 : 82
      const score = Math.min(100, baseline + Math.floor(Math.random() * 10) - 4)
      return { score, message: score >= 80 ? 'No high-severity findings.' : 'Potential vulnerability flagged for remediation.' }
    },
  },
  {
    kind: 'tests',
    label: 'Test gate',
    hard: false,
    evaluate: (_r, task) => {
      const score = task.teamKind === 'qa' ? 96 : 84 + Math.floor(Math.random() * 12)
      return { score, message: `Coverage ${score}% across affected modules.` }
    },
  },
  {
    kind: 'cost',
    label: 'Cost budget',
    hard: false,
    evaluate: (run) => {
      const ok = run.metrics.estimatedCostUsd <= 25
      return { score: ok ? 100 : 55, message: ok ? 'Within per-run budget.' : 'Projected cost exceeds budget — flagged.' }
    },
  },
]

/** Run every validator over a task's result and attach the gates. */
export function validateTask(run: Run, task: Task, result: ExecResult): QualityGate[] {
  const gates: QualityGate[] = VALIDATORS.map((v) => {
    const { score, message } = v.evaluate(run, task, result)
    const outcome = score >= passThreshold(v.kind) ? 'pass' : v.hard ? 'fail' : 'pass'
    const gate: QualityGate = {
      id: `gate_${nanoid(8)}`,
      kind: v.kind,
      label: v.label,
      outcome,
      score,
      message,
      evaluatedBy: pickValidatorAgent(),
      evaluatedAt: Date.now(),
    }
    bus.emit('gate', { runId: run.id, taskId: task.id, gate }, run.id)
    return gate
  })

  const failed = gates.filter((g) => g.outcome === 'fail')
  if (failed.length) {
    logger.warn('validators', `Task "${task.title}" failed ${failed.length} gate(s): ${failed.map((g) => g.kind).join(', ')}`, run.id)
  } else {
    logger.info('validators', `Task "${task.title}" passed all quality gates`, run.id)
  }
  return gates
}

function passThreshold(kind: GateKind): number {
  switch (kind) {
    case 'security':
      return 80
    case 'schema':
      return 70
    case 'cost':
      return 60
    default:
      return 65
  }
}

function pickValidatorAgent(): string {
  const team = store.teamByKind('qa') ?? store.teamByKind('security')
  const agent = team ? store.agentsOfTeam(team.id).find((a) => a.role === 'validator') : null
  return agent?.id ?? 'validator'
}

/** Whether the gate set blocks progression (any hard gate failed). */
export function gatesBlock(gates: QualityGate[]): boolean {
  return gates.some((g) => g.outcome === 'fail')
}
