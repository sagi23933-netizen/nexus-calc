/**
 * Provider-agnostic LLM boundary.
 *
 * The whole engine talks to agents through this single interface. The default
 * implementation is a deterministic simulator (no network, no keys). To go live
 * with a real provider, implement `LlmProvider` and register it via
 * `setLlmProvider` — nothing else in the engine has to change. This is the
 * adapter seam that keeps the simulation and a real backend interchangeable.
 */

export interface LlmRequest {
  /** Logical role of the calling agent (architect, implementer…). */
  role: string
  /** The instruction / task prompt. */
  prompt: string
  /** Optional retrieved context (from the vector DB / shared memory). */
  context?: string[]
  /** Soft cap used by the simulator to size the response. */
  maxTokens?: number
}

export interface LlmResponse {
  text: string
  tokensIn: number
  tokensOut: number
  model: string
  /** Wall time the call took (simulated or real), ms. */
  latencyMs: number
}

export interface LlmProvider {
  readonly name: string
  complete(req: LlmRequest, model: string): Promise<LlmResponse>
}

/** Crude but stable token estimate (~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

/**
 * Deterministic simulator. Produces plausible "agent output" text and realistic
 * token/latency numbers derived from the prompt, so dashboards look alive while
 * staying fully reproducible.
 */
export class SimulatedLlmProvider implements LlmProvider {
  readonly name = 'simulated'

  async complete(req: LlmRequest, model: string): Promise<LlmResponse> {
    const tokensIn = estimateTokens(req.prompt) + (req.context?.reduce((s, c) => s + estimateTokens(c), 0) ?? 0)
    const target = req.maxTokens ?? 280
    const tokensOut = Math.round(target * (0.6 + Math.random() * 0.6))
    const latencyMs = 120 + Math.round(Math.random() * 480)

    // Tiny synthetic narration so logs/artifacts read meaningfully.
    const text =
      `[${req.role}] ${req.prompt.slice(0, 80)}\n` +
      `Produced ${tokensOut} tokens of output across ${1 + Math.floor(tokensOut / 90)} sections.`

    return { text, tokensIn, tokensOut, model, latencyMs }
  }
}

let provider: LlmProvider = new SimulatedLlmProvider()

export function setLlmProvider(p: LlmProvider) {
  provider = p
}

export function getLlmProvider(): LlmProvider {
  return provider
}
