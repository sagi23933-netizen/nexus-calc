const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api';
const TOKEN_KEY = 'nexus.auth.token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  const data = text ? safeJSON(text) : null;
  if (!res.ok) {
    const err = (data ?? {}) as { message?: string; error?: string };
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
  }
  return data as T;
}

function safeJSON(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface Agent {
  id: string;
  name: string;
  role?: string | null;
  description?: string | null;
  model: string;
  provider: 'openai' | 'anthropic' | string;
  systemPrompt: string;
  tools: unknown[];
  status: string;
  temperature: number;
  maxTokens: number;
  createdAt: number;
  updatedAt: number;
}

export interface Workflow {
  id: string;
  projectId: string | null;
  name: string;
  description: string | null;
  graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowNode {
  id: string;
  type: 'input' | 'agent' | 'condition' | 'transform' | 'log' | 'output' | string;
  data?: Record<string, unknown>;
}
export interface WorkflowEdge { source: string; target: string }

export interface AgentRunResult {
  runId: string;
  output: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
}

export interface WorkflowRunResult {
  runId: string;
  status: 'success' | 'error';
  output?: unknown;
  error?: string;
  durationMs: number;
  tokensUsed: number;
}

export const aiApi = {
  health: () => request<{ ok: boolean }>('/health'),

  register: (email: string, password: string, name?: string) =>
    request<{ token: string; user: AuthUser }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: AuthUser }>('/auth/me'),

  listAgents: () => request<{ agents: Agent[] }>('/agents'),
  createAgent: (data: Partial<Agent>) => request<{ agent: Agent }>('/agents', {
    method: 'POST', body: JSON.stringify(data),
  }),
  updateAgent: (id: string, data: Partial<Agent>) => request<{ agent: Agent }>(`/agents/${id}`, {
    method: 'PATCH', body: JSON.stringify(data),
  }),
  deleteAgent: (id: string) => request<{ ok: boolean }>(`/agents/${id}`, { method: 'DELETE' }),
  runAgent: (id: string, input: string) => request<AgentRunResult>(`/agents/${id}/run`, {
    method: 'POST', body: JSON.stringify({ input }),
  }),
  agentRuns: (id: string) => request<{ runs: unknown[] }>(`/agents/${id}/runs`),

  listWorkflows: () => request<{ workflows: Workflow[] }>('/workflows'),
  getWorkflow: (id: string) => request<{ workflow: Workflow }>(`/workflows/${id}`),
  createWorkflow: (data: Partial<Workflow>) => request<{ workflow: Workflow }>('/workflows', {
    method: 'POST', body: JSON.stringify(data),
  }),
  updateWorkflow: (id: string, data: Partial<Workflow>) => request<{ workflow: Workflow }>(`/workflows/${id}`, {
    method: 'PATCH', body: JSON.stringify(data),
  }),
  deleteWorkflow: (id: string) => request<{ ok: boolean }>(`/workflows/${id}`, { method: 'DELETE' }),
  runWorkflow: (id: string, input: unknown) => request<WorkflowRunResult>(`/workflows/${id}/run`, {
    method: 'POST', body: JSON.stringify({ input }),
  }),
  workflowRuns: (id: string) => request<{ runs: unknown[] }>(`/workflows/${id}/runs`),
  runLogs: (runId: string) => request<{ run: unknown; logs: unknown[] }>(`/workflows/runs/${runId}/logs`),

  listApiKeys: () => request<{ keys: { id: string; provider: string; label: string | null; created_at: number }[] }>('/api-keys'),
  createApiKey: (provider: string, key: string, label?: string) => request<{ id: string }>('/api-keys', {
    method: 'POST', body: JSON.stringify({ provider, key, label }),
  }),
  deleteApiKey: (id: string) => request<{ ok: boolean }>(`/api-keys/${id}`, { method: 'DELETE' }),
};
