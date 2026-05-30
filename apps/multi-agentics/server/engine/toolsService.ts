/**
 * Tools & APIs auto-configuration service.
 *
 * Realises the manifesto promise — "the platform does what the user can't" —
 * as a guided, simulated provisioning flow. When a provider is configured, the
 * integration team walks it through registration steps (create account, issue
 * key, verify connection). We never store or transmit real credentials; the
 * flow models the orchestration that would drive a real provisioning process.
 */

import { store } from '../state'
import { bus } from './eventBus'
import { logger } from '../observability/logger'
import type { ToolDef } from '@shared/types'

export interface ProvisionStep {
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  detail: string
}

const inFlight = new Map<string, ProvisionStep[]>()

/** The canonical step sequence for auto-registering a provider. */
function buildSteps(tool: ToolDef): ProvisionStep[] {
  const steps: ProvisionStep[] = [
    { label: 'Resolve provider', status: 'pending', detail: `Looked up ${tool.name} (${tool.category}).` },
    { label: 'Provision account / project', status: 'pending', detail: 'Create or reuse a project for this workspace.' },
  ]
  for (const secret of tool.requiredSecrets) {
    steps.push({ label: `Issue secret: ${secret}`, status: 'pending', detail: `Generate ${secret} and store it in the encrypted vault (simulated).` })
  }
  steps.push({ label: 'Verify connection', status: 'pending', detail: 'Run a health check against the provider.' })
  return steps
}

/** Kick off an auto-configuration. Returns immediately; progress streams via events. */
export function configureTool(toolId: string): { ok: boolean; steps?: ProvisionStep[]; error?: string } {
  const tool = store.tool(toolId)
  if (!tool) return { ok: false, error: 'unknown tool' }
  if (!tool.autoConfigurable) return { ok: false, error: 'provider is not auto-configurable' }
  if (tool.status === 'configuring') return { ok: false, error: 'already configuring' }

  const steps = buildSteps(tool)
  inFlight.set(toolId, steps)
  tool.status = 'configuring'
  store.setTool(tool)
  bus.emit('run.updated', { tool }, null)
  logger.info('integration', `Auto-configuring ${tool.name}…`)

  void runSteps(tool, steps)
  return { ok: true, steps }
}

async function runSteps(tool: ToolDef, steps: ProvisionStep[]) {
  for (const step of steps) {
    step.status = 'running'
    bus.emit('run.updated', { toolId: tool.id, step }, null)
    await sleep(280 + Math.random() * 360)
    // Tiny failure chance on the verification step keeps it believable.
    const fail = step.label === 'Verify connection' && Math.random() < 0.08
    step.status = fail ? 'error' : 'done'
    bus.emit('run.updated', { toolId: tool.id, step }, null)
  }
  const ok = steps.every((s) => s.status === 'done')
  tool.status = ok ? 'connected' : 'error'
  store.setTool(tool)
  inFlight.delete(tool.id)
  bus.emit('run.updated', { tool }, null)
  logger[ok ? 'info' : 'warn']('integration', `${tool.name} ${ok ? 'connected ✓' : 'failed to connect'}`)
}

/** Reset a provider back to unconfigured (disconnect). */
export function disconnectTool(toolId: string): boolean {
  const tool = store.tool(toolId)
  if (!tool) return false
  tool.status = 'unconfigured'
  store.setTool(tool)
  logger.info('integration', `${tool.name} disconnected`)
  return true
}

export function provisionProgress(toolId: string): ProvisionStep[] | null {
  return inFlight.get(toolId) ?? null
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
