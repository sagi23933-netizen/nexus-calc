import { db } from '../db.js';
import { decrypt, newId } from '../utils/crypto.js';

function getApiKeyFor(userId, provider) {
  const row = db.prepare(`SELECT * FROM api_keys WHERE user_id = ? AND provider = ? ORDER BY created_at DESC LIMIT 1`)
    .get(userId, provider);
  if (!row) return null;
  try {
    return decrypt({ ciphertext: row.ciphertext, iv: row.iv, tag: row.tag });
  } catch {
    return null;
  }
}

function markKeyUsed(userId, provider) {
  db.prepare(`UPDATE api_keys SET last_used_at = ? WHERE user_id = ? AND provider = ?`)
    .run(Date.now(), userId, provider);
}

async function callOpenAI({ apiKey, model, systemPrompt, input, temperature, maxTokens }) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: input },
      ],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `OpenAI error ${resp.status}`);
  return {
    output: data.choices?.[0]?.message?.content ?? '',
    model: data.model,
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };
}

async function callAnthropic({ apiKey, model, systemPrompt, input, temperature, maxTokens }) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt || undefined,
      messages: [{ role: 'user', content: input }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Anthropic error ${resp.status}`);
  const text = Array.isArray(data.content)
    ? data.content.filter(b => b.type === 'text').map(b => b.text).join('')
    : '';
  return {
    output: text,
    model: data.model,
    promptTokens: data.usage?.input_tokens ?? 0,
    completionTokens: data.usage?.output_tokens ?? 0,
  };
}

function mockEcho({ systemPrompt, input }) {
  const summary = input.length > 280 ? input.slice(0, 277) + '...' : input;
  return {
    output: `[mock] ${systemPrompt ? `(${systemPrompt.slice(0, 60)}) ` : ''}${summary}`,
    model: 'mock-echo',
    promptTokens: Math.ceil(input.length / 4),
    completionTokens: Math.ceil(summary.length / 4),
  };
}

export async function runAgent({ agent, userId, input }) {
  const started = Date.now();
  const runId = newId('run_');
  let result;
  let error = null;

  try {
    const apiKey = getApiKeyFor(userId, agent.provider);
    if (!apiKey) {
      result = mockEcho({ systemPrompt: agent.systemPrompt, input });
    } else if (agent.provider === 'openai') {
      result = await callOpenAI({
        apiKey, model: agent.model, systemPrompt: agent.systemPrompt, input,
        temperature: agent.temperature, maxTokens: agent.maxTokens,
      });
      markKeyUsed(userId, 'openai');
    } else if (agent.provider === 'anthropic') {
      result = await callAnthropic({
        apiKey, model: agent.model, systemPrompt: agent.systemPrompt, input,
        temperature: agent.temperature, maxTokens: agent.maxTokens,
      });
      markKeyUsed(userId, 'anthropic');
    } else {
      throw new Error(`unsupported_provider:${agent.provider}`);
    }
  } catch (err) {
    error = err?.message || String(err);
    result = { output: null, model: agent.model, promptTokens: 0, completionTokens: 0 };
  }

  const duration = Date.now() - started;
  db.prepare(`INSERT INTO agent_runs
    (id, agent_id, user_id, input, output, error, model, prompt_tokens, completion_tokens, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    runId, agent.id, userId, input, result.output, error,
    result.model, result.promptTokens, result.completionTokens, duration, started,
  );

  if (error) {
    const e = new Error(error);
    e.runId = runId;
    throw e;
  }

  return {
    runId,
    output: result.output,
    model: result.model,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    durationMs: duration,
  };
}
