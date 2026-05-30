/**
 * Directed acyclic graph utilities for the task planner.
 *
 * The decomposer produces tasks with `dependsOn` edges. This module turns that
 * into a navigable DAG and provides the graph algorithms the scheduler relies
 * on: cycle detection, topological ordering (Kahn's algorithm), depth/level
 * assignment for tidy layout, and longest-path (critical-path) computation used
 * to prioritise the chain that bounds total wall-clock time.
 */

import type { Task } from '@shared/types'

export interface DagNode {
  id: string
  dependsOn: string[]
  dependents: string[]
  weight: number // estimated duration, used for critical-path
}

export class Dag {
  private nodes = new Map<string, DagNode>()

  constructor(tasks: Pick<Task, 'id' | 'dependsOn' | 'estimateMs'>[]) {
    for (const t of tasks) {
      this.nodes.set(t.id, {
        id: t.id,
        dependsOn: [...t.dependsOn],
        dependents: [],
        weight: Math.max(1, t.estimateMs),
      })
    }
    // Wire reverse edges, ignoring dangling references defensively.
    for (const node of this.nodes.values()) {
      for (const dep of node.dependsOn) {
        this.nodes.get(dep)?.dependents.push(node.id)
      }
    }
  }

  get size(): number {
    return this.nodes.size
  }

  has(id: string): boolean {
    return this.nodes.has(id)
  }

  dependentsOf(id: string): string[] {
    return this.nodes.get(id)?.dependents ?? []
  }

  dependenciesOf(id: string): string[] {
    return this.nodes.get(id)?.dependsOn ?? []
  }

  /** Detect a cycle; returns the offending node ids if the graph is cyclic. */
  findCycle(): string[] | null {
    const WHITE = 0
    const GRAY = 1
    const BLACK = 2
    const color = new Map<string, number>()
    const stack: string[] = []
    for (const id of this.nodes.keys()) color.set(id, WHITE)

    const visit = (id: string): string[] | null => {
      color.set(id, GRAY)
      stack.push(id)
      for (const next of this.nodes.get(id)!.dependents) {
        const c = color.get(next)
        if (c === GRAY) {
          // Found a back edge — slice the cycle out of the current stack.
          const start = stack.indexOf(next)
          return stack.slice(start)
        }
        if (c === WHITE) {
          const found = visit(next)
          if (found) return found
        }
      }
      stack.pop()
      color.set(id, BLACK)
      return null
    }

    for (const id of this.nodes.keys()) {
      if (color.get(id) === WHITE) {
        const cycle = visit(id)
        if (cycle) return cycle
      }
    }
    return null
  }

  /** Kahn's algorithm — returns a topological ordering of node ids. */
  topologicalOrder(): string[] {
    const indegree = new Map<string, number>()
    for (const node of this.nodes.values()) {
      indegree.set(node.id, node.dependsOn.filter((d) => this.nodes.has(d)).length)
    }
    // Seed the queue with roots, then peel layers off.
    const queue: string[] = []
    for (const [id, deg] of indegree) if (deg === 0) queue.push(id)
    const order: string[] = []
    while (queue.length) {
      const id = queue.shift()!
      order.push(id)
      for (const next of this.nodes.get(id)!.dependents) {
        const deg = indegree.get(next)! - 1
        indegree.set(next, deg)
        if (deg === 0) queue.push(next)
      }
    }
    return order
  }

  /** Assign each node a depth = longest dependency chain length (for layout). */
  assignDepths(): Map<string, number> {
    const depth = new Map<string, number>()
    for (const id of this.topologicalOrder()) {
      const deps = this.nodes.get(id)!.dependsOn.filter((d) => this.nodes.has(d))
      const d = deps.length === 0 ? 0 : Math.max(...deps.map((x) => (depth.get(x) ?? 0) + 1))
      depth.set(id, d)
    }
    return depth
  }

  /**
   * Critical path = the maximum-weight path through the DAG. Its total weight is
   * the lower bound on wall-clock time given unlimited parallelism; the scheduler
   * boosts the priority of tasks on this path.
   */
  criticalPath(): { path: string[]; length: number } {
    const order = this.topologicalOrder()
    const best = new Map<string, number>() // best finish weight ending at node
    const prev = new Map<string, string | null>()
    for (const id of order) {
      const node = this.nodes.get(id)!
      let bestDep = 0
      let bestPrev: string | null = null
      for (const dep of node.dependsOn) {
        const w = best.get(dep) ?? 0
        if (w > bestDep) {
          bestDep = w
          bestPrev = dep
        }
      }
      best.set(id, bestDep + node.weight)
      prev.set(id, bestPrev)
    }
    // Find the heaviest endpoint, then walk back.
    let endId: string | null = null
    let endWeight = -1
    for (const [id, w] of best) {
      if (w > endWeight) {
        endWeight = w
        endId = id
      }
    }
    const path: string[] = []
    let cur = endId
    while (cur) {
      path.unshift(cur)
      cur = prev.get(cur) ?? null
    }
    return { path, length: Math.max(0, endWeight) }
  }

  /** Set of node ids that lie on the critical path (for priority boosting). */
  criticalSet(): Set<string> {
    return new Set(this.criticalPath().path)
  }

  /** Maximum theoretical parallelism = the widest depth level. */
  maxWidth(): number {
    const depths = this.assignDepths()
    const counts = new Map<number, number>()
    for (const d of depths.values()) counts.set(d, (counts.get(d) ?? 0) + 1)
    return Math.max(1, ...counts.values())
  }
}
