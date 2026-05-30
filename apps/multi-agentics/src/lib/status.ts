/** Status → colour mappings shared by pills, dots and the diagram. */

import type { HealthStatus, RunStatus, Severity, TaskStatus } from '@shared/types'

export const RUN_STATUS_COLOR: Record<RunStatus, string> = {
  queued: '#5d6f8f',
  decomposing: '#3b82f6',
  planning: '#3b82f6',
  executing: '#22d3ee',
  validating: '#a855f7',
  reviewing: '#f59e0b',
  awaiting_approval: '#f59e0b',
  shipping: '#10b981',
  completed: '#10b981',
  failed: '#ef4444',
  cancelled: '#5d6f8f',
}

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  pending: '#5d6f8f',
  ready: '#3b82f6',
  running: '#22d3ee',
  validating: '#a855f7',
  blocked: '#f59e0b',
  succeeded: '#10b981',
  failed: '#ef4444',
  skipped: '#475569',
}

export const HEALTH_COLOR: Record<HealthStatus, string> = {
  idle: '#5d6f8f',
  active: '#10b981',
  busy: '#22d3ee',
  degraded: '#f59e0b',
  offline: '#475569',
  error: '#ef4444',
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  debug: '#5d6f8f',
  info: '#60a5fa',
  notice: '#22d3ee',
  warning: '#f59e0b',
  error: '#ef4444',
  critical: '#f43f5e',
}

export function runStatusColor(s: RunStatus): string {
  return RUN_STATUS_COLOR[s] ?? '#5d6f8f'
}
export function taskStatusColor(s: TaskStatus): string {
  return TASK_STATUS_COLOR[s] ?? '#5d6f8f'
}
