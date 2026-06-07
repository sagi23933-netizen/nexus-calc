// Thin client for the ThinkLayer backend.
const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export type ReasoningMode = "fast" | "deep" | "research" | "coding" | "math" | "agent";

export interface TraceStep {
  step: string;
  detail: string;
  ms: number;
}

export interface ChatResult {
  final_answer: string;
  plan: string | null;
  draft: string | null;
  critique: string | null;
  verification: string | null;
  trace: TraceStep[];
  metadata: Record<string, unknown>;
  conversation_id: string;
}

export interface ModelInfo {
  id: string;
  provider: string;
  name: string | null;
  available: boolean;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => get<{ status: string; modes: string[] }>("/api/health"),
  listModels: () => get<{ models: ModelInfo[]; default: string }>("/api/models"),
  chat: (req: {
    prompt: string;
    model_id?: string;
    mode: ReasoningMode;
    conversation_id?: string;
    use_rag?: boolean;
  }) => post<ChatResult>("/api/chat", req),
  runBenchmark: (req: { model_id?: string; mode: ReasoningMode; test_set?: string }) =>
    post<{ ok: boolean; summary: Record<string, number>; results: unknown[] }>("/api/evals/run", req),
};
