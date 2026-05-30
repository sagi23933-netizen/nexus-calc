/**
 * Task Decomposer + Planner.
 *
 * Turns a high-level product Goal into a directed acyclic graph of tasks
 * distributed across the specialized teams. The decomposition is template-driven
 * but adapts its breadth to the goal's complexity (inferred from the requested
 * stack, constraints and description length) so larger goals fan out into more
 * parallel work — mirroring how a real planner would scale the plan.
 */

import { nanoid } from 'nanoid'
import { Dag } from './dag'
import { MAX_TASKS_PER_RUN } from '@shared/constants'
import type { Goal, Task, TaskPriority, TeamKind } from '@shared/types'

interface TaskSpec {
  key: string
  title: string
  description: string
  teamKind: TeamKind
  requiredSkills: string[]
  dependsOn: string[]
  estimateMs: number
  priority?: TaskPriority
}

/** Infer a 1..5 complexity score from the goal. */
function complexityOf(goal: Goal): number {
  let score = 1
  score += Math.min(2, Math.floor(goal.stack.length / 2))
  score += Math.min(1, Math.floor(goal.constraints.length / 2))
  score += goal.description.length > 280 ? 1 : 0
  if (goal.priority === 'critical' || goal.priority === 'high') score += 1
  return Math.max(1, Math.min(5, score))
}

/**
 * Build the task specs. Roots have no dependencies; later phases depend on
 * earlier ones, producing a layered DAG with genuine parallelism inside layers.
 */
function planSpecs(goal: Goal): TaskSpec[] {
  const c = complexityOf(goal)
  const specs: TaskSpec[] = []

  // --- Phase 0: research & spec (roots) ---
  specs.push({ key: 'research', title: 'Research approaches & constraints', description: `Survey viable approaches for "${goal.title}", evaluate trade-offs and pick a direction.`, teamKind: 'research', requiredSkills: ['benchmarking', 'prototyping'], dependsOn: [], estimateMs: 1400 })
  specs.push({ key: 'spec', title: 'Write technical specification (RFC)', description: 'Produce an RFC capturing scope, interfaces and milestones.', teamKind: 'research', requiredSkills: ['rfc', 'design-docs'], dependsOn: ['research'], estimateMs: 1200 })

  // --- Phase 1: architecture & design (parallel) ---
  specs.push({ key: 'arch', title: 'System architecture', description: 'Define services, data flow and module boundaries.', teamKind: 'backend', requiredSkills: ['system-design'], dependsOn: ['spec'], estimateMs: 1600, priority: 'high' })
  specs.push({ key: 'design', title: 'UX flows & visual design', description: 'Wireframe core flows and define the visual language.', teamKind: 'design', requiredSkills: ['wireframes', 'visual-design'], dependsOn: ['spec'], estimateMs: 1500 })
  specs.push({ key: 'data-model', title: 'Data model & schema', description: 'Design the persistence schema and data contracts.', teamKind: 'data', requiredSkills: ['modeling'], dependsOn: ['arch'], estimateMs: 1300 })

  // --- Phase 2: implementation (wide fan-out, scaled by complexity) ---
  const backendModules = ['core API', 'auth & sessions', 'business logic', 'persistence layer', 'background jobs']
  const frontendModules = ['app shell & routing', 'primary views', 'forms & validation', 'state management', 'design-system components']
  const nBackend = Math.min(backendModules.length, 2 + c)
  const nFrontend = Math.min(frontendModules.length, 2 + c)

  for (let i = 0; i < nBackend; i++) {
    specs.push({ key: `be_${i}`, title: `Implement backend: ${backendModules[i]}`, description: `Build the ${backendModules[i]} module per the architecture.`, teamKind: 'backend', requiredSkills: ['typescript', 'node'], dependsOn: ['arch', 'data-model'], estimateMs: 1800 })
  }
  for (let i = 0; i < nFrontend; i++) {
    specs.push({ key: `fe_${i}`, title: `Implement frontend: ${frontendModules[i]}`, description: `Build the ${frontendModules[i]} per the design.`, teamKind: 'frontend', requiredSkills: ['react', 'typescript'], dependsOn: ['design', 'arch'], estimateMs: 1700 })
  }

  // Data / ML pipeline when the stack hints at it, else a lighter analytics task.
  const wantsData = goal.stack.some((s) => /ml|ai|data|analytics|python/i.test(s)) || c >= 3
  if (wantsData) {
    specs.push({ key: 'pipeline', title: 'Build data pipeline', description: 'Implement ingestion, transformation and storage pipeline.', teamKind: 'data', requiredSkills: ['etl'], dependsOn: ['data-model'], estimateMs: 1600 })
  }

  // --- Phase 3: integration ---
  const beKeys = specs.filter((s) => s.key.startsWith('be_')).map((s) => s.key)
  const feKeys = specs.filter((s) => s.key.startsWith('fe_')).map((s) => s.key)
  specs.push({ key: 'integrate', title: 'Wire frontend ↔ backend & external APIs', description: 'Connect the UI to the API and configure required third-party services.', teamKind: 'integration', requiredSkills: ['rest-clients', 'oauth'], dependsOn: [...beKeys, ...feKeys], estimateMs: 1500 })
  specs.push({ key: 'devops', title: 'CI/CD & infrastructure', description: 'Containerise, define IaC and set up the deployment pipeline.', teamKind: 'devops', requiredSkills: ['ci-cd', 'iac'], dependsOn: ['arch'], estimateMs: 1400 })

  // --- Phase 4: quality & security (gates) ---
  specs.push({ key: 'tests', title: 'Author automated test suite', description: 'Unit, integration and e2e tests across the build.', teamKind: 'qa', requiredSkills: ['unit-tests', 'e2e'], dependsOn: ['integrate'], estimateMs: 1600, priority: 'high' })
  specs.push({ key: 'security', title: 'Security audit & hardening', description: 'SAST/DAST scan, dependency audit and remediation.', teamKind: 'security', requiredSkills: ['sast', 'owasp'], dependsOn: ['integrate'], estimateMs: 1500, priority: 'high' })
  if (c >= 4) {
    specs.push({ key: 'load', title: 'Load & performance testing', description: 'Stress the system and tune hot paths.', teamKind: 'qa', requiredSkills: ['load-testing'], dependsOn: ['integrate'], estimateMs: 1300 })
  }

  // --- Phase 5: docs & release ---
  specs.push({ key: 'docs', title: 'Documentation & onboarding', description: 'API reference, quickstart and tutorials.', teamKind: 'docs', requiredSkills: ['tutorials', 'api-reference'], dependsOn: ['integrate'], estimateMs: 1100 })
  specs.push({ key: 'release', title: 'Release packaging & deploy plan', description: 'Cut a versioned release and prepare the production deployment.', teamKind: 'devops', requiredSkills: ['ci-cd'], dependsOn: ['tests', 'security', 'docs'], estimateMs: 1000, priority: 'high' })

  return specs.slice(0, MAX_TASKS_PER_RUN)
}

/** Materialise specs into Task records (with generated ids and remapped deps). */
export function decompose(runId: string, goal: Goal): Task[] {
  const specs = planSpecs(goal)
  const idByKey = new Map<string, string>()
  for (const s of specs) idByKey.set(s.key, `task_${nanoid(8)}`)

  const tasks: Task[] = specs.map((s) => ({
    id: idByKey.get(s.key)!,
    runId,
    title: s.title,
    description: s.description,
    teamKind: s.teamKind,
    requiredSkills: s.requiredSkills,
    dependsOn: s.dependsOn.map((k) => idByKey.get(k)!).filter(Boolean),
    status: 'pending',
    priority: s.priority ?? goal.priority,
    estimateMs: s.estimateMs,
    assignedAgentId: null,
    startedAt: null,
    finishedAt: null,
    attempts: 0,
    artifacts: [],
    gates: [],
    depth: 0,
  }))

  // Compute depth from the DAG for tidy graph layout, and guard against cycles.
  const dag = new Dag(tasks)
  const cycle = dag.findCycle()
  if (cycle) {
    // The templates are acyclic by construction; if a cycle ever appears we
    // break it defensively by dropping the back edge so the run can proceed.
    const last = cycle[cycle.length - 1]
    const first = cycle[0]
    const t = tasks.find((x) => x.id === last)
    if (t) t.dependsOn = t.dependsOn.filter((d) => d !== first)
  }
  const depths = new Dag(tasks).assignDepths()
  for (const t of tasks) t.depth = depths.get(t.id) ?? 0

  return tasks
}
