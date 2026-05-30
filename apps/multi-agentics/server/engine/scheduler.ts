/**
 * Scheduler — drives a run's task DAG to completion with safe parallelism.
 *
 * Algorithm:
 *   1. Build the DAG and compute the critical path (priority boost).
 *   2. Repeatedly find "ready" tasks (all dependencies succeeded) and submit
 *      them to a bounded worker pool — true parallel execution, capped so no
 *      stage floods (backpressure).
 *   3. On completion, run validator gates. If a hard gate blocks and the task
 *      has retries left, send it back to "ready" for remediation; otherwise mark
 *      it succeeded/failed and unlock its dependents.
 *   4. Finish when every task is terminal.
 *
 * The whole loop is event-driven via the pool; there is no busy-wait.
 */

import { Dag } from './dag'
import { WorkerPool } from './workerPool'
import { store } from '../state'
import { bus } from './eventBus'
import { logger } from '../observability/logger'
import { metrics } from '../observability/metrics'
import { executeTask } from './agentSimulator'
import { validateTask, gatesBlock } from './validators'
import { MAX_PARALLEL_WORKERS, COST_PER_1K_TOKENS } from '@shared/constants'
import type { Run, Task } from '@shared/types'

const MAX_ATTEMPTS = 3

export interface ScheduleResult {
  succeeded: number
  failed: number
  parallelPeak: number
  criticalPathMs: number
}

export async function executeRun(run: Run): Promise<ScheduleResult> {
  const tasks = store.tasksOfRun(run.id)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const dag = new Dag(tasks)
  const critical = dag.criticalSet()
  const criticalPathMs = dag.criticalPath().length

  const pool = new WorkerPool({
    concurrency: MAX_PARALLEL_WORKERS,
    onActiveChange: (active) => {
      run.metrics.parallelPeak = Math.max(run.metrics.parallelPeak, active)
      metrics.gauge('parallelism', 'Active agents', 'agents', active)
    },
  })

  // Mark roots ready.
  for (const t of tasks) {
    t.status = t.dependsOn.length === 0 ? 'ready' : 'pending'
    store.setTask(t)
  }

  let settled = 0
  const terminalStates = new Set(['succeeded', 'failed', 'skipped'])

  return new Promise<ScheduleResult>((resolve) => {
    const tryDispatchReady = () => {
      for (const t of byId.values()) {
        if (t.status !== 'ready') continue
        t.status = 'running'
        t.startedAt = Date.now()
        t.attempts++
        store.setTask(t)
        bus.emit('task.updated', t, run.id)

        // Critical-path tasks get the highest priority so the longest chain never waits.
        const priority = (critical.has(t.id) ? 100 : 0) + priorityWeight(t)
        void pool.submit({ id: t.id, priority, run: () => runOneTask(run, t) }).then(() => {
          onTaskSettled(t)
        })
      }
    }

    const runOneTask = async (r: Run, task: Task) => {
      const result = await executeTask(r, task)

      // Roll up run-level metrics regardless of pass/fail.
      r.metrics.tokensUsed += result.tokensUsed
      r.metrics.estimatedCostUsd = Number(((r.metrics.tokensUsed / 1000) * COST_PER_1K_TOKENS).toFixed(2))
      if (result.ok) {
        r.metrics.linesOfCode += result.linesOfCode
        r.metrics.filesGenerated += result.artifacts.length
        task.artifacts = result.artifacts.map((a) => a.path)
      }
      task.assignedAgentId = result.agentId || task.assignedAgentId
      metrics.gauge('loc', 'Lines of code', 'lines', r.metrics.linesOfCode)
      metrics.gauge('tokens', 'Tokens used', 'tokens', r.metrics.tokensUsed)

      // Quality gates.
      task.status = 'validating'
      store.setTask(task)
      bus.emit('task.updated', task, r.id)
      const gates = validateTask(r, task, result)
      task.gates = gates

      if (!result.ok || gatesBlock(gates)) {
        if (task.attempts < MAX_ATTEMPTS) {
          // Remediation: send the task back to ready for another agent attempt.
          task.status = 'ready'
          task.startedAt = null
          store.setTask(task)
          bus.emit('task.updated', task, r.id)
          logger.notice('scheduler', `Re-queuing "${task.title}" (attempt ${task.attempts + 1}/${MAX_ATTEMPTS})`, r.id)
          return 'requeued' as const
        }
        task.status = 'failed'
        task.finishedAt = Date.now()
        store.setTask(task)
        bus.emit('task.updated', task, r.id)
        return 'failed' as const
      }

      task.status = 'succeeded'
      task.finishedAt = Date.now()
      store.setTask(task)
      bus.emit('task.updated', task, r.id)
      return 'succeeded' as const
    }

    const onTaskSettled = (task: Task) => {
      // If it was re-queued, dispatch picks it up again; only count terminals.
      if (!terminalStates.has(task.status)) {
        tryDispatchReady()
        return
      }
      settled++

      // Unlock dependents whose dependencies are now all succeeded.
      if (task.status === 'succeeded') {
        for (const depId of dag.dependentsOf(task.id)) {
          const dep = byId.get(depId)
          if (!dep || dep.status !== 'pending') continue
          const ready = dep.dependsOn.every((d) => byId.get(d)?.status === 'succeeded')
          if (ready) {
            dep.status = 'ready'
            store.setTask(dep)
            bus.emit('task.updated', dep, run.id)
          }
        }
      } else if (task.status === 'failed') {
        // Skip descendants that can no longer be satisfied.
        skipDescendants(task.id)
      }

      // Update progress.
      run.metrics.succeeded = countStatus('succeeded')
      run.metrics.failed = countStatus('failed')
      run.progress = run.metrics.totalTasks ? settled / run.metrics.totalTasks : 1
      bus.emit('run.updated', run, run.id)

      if (settled >= run.metrics.totalTasks) {
        run.metrics.parallelPeak = pool.peakConcurrency
        run.metrics.criticalPathMs = criticalPathMs
        resolve({
          succeeded: run.metrics.succeeded,
          failed: run.metrics.failed,
          parallelPeak: pool.peakConcurrency,
          criticalPathMs,
        })
      } else {
        tryDispatchReady()
      }
    }

    const skipDescendants = (rootId: string) => {
      const stack = [...dag.dependentsOf(rootId)]
      while (stack.length) {
        const id = stack.pop()!
        const t = byId.get(id)
        if (!t || t.status !== 'pending') continue
        t.status = 'skipped'
        t.finishedAt = Date.now()
        store.setTask(t)
        settled++
        bus.emit('task.updated', t, run.id)
        stack.push(...dag.dependentsOf(id))
      }
    }

    const countStatus = (status: Task['status']) =>
      [...byId.values()].filter((t) => t.status === status).length

    // Kick off.
    tryDispatchReady()
  })
}

function priorityWeight(task: Task): number {
  switch (task.priority) {
    case 'critical':
      return 40
    case 'high':
      return 25
    case 'normal':
      return 10
    default:
      return 0
  }
}
