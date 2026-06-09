import { db } from '../db.js';
import { newId } from '../utils/crypto.js';
import { runAgent } from './runner.js';

function log(runId, level, message, nodeId = null, data = null) {
  db.prepare(`INSERT INTO run_logs (id, run_id, node_id, level, message, data_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(newId('log_'), runId, nodeId, level, message, data ? JSON.stringify(data) : null, Date.now());
}

function getAgent(id, userId) {
  const row = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    description: row.description,
    model: row.model,
    provider: row.provider,
    systemPrompt: row.system_prompt,
    tools: JSON.parse(row.tools_json || '[]'),
    status: row.status,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
  };
}

function resolveTemplate(template, ctx) {
  if (template == null) return '';
  return String(template).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const parts = path.split('.');
    let value = ctx;
    for (const p of parts) {
      if (value == null) return '';
      value = value[p];
    }
    return value == null ? '' : String(value);
  });
}

function topoOrder(graph) {
  const { nodes = [], edges = [] } = graph || {};
  const incoming = new Map(nodes.map(n => [n.id, 0]));
  const adjacency = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges) {
    if (!incoming.has(e.target) || !adjacency.has(e.source)) continue;
    incoming.set(e.target, incoming.get(e.target) + 1);
    adjacency.get(e.source).push(e.target);
  }
  const queue = nodes.filter(n => (incoming.get(n.id) || 0) === 0).map(n => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const next of adjacency.get(id) || []) {
      incoming.set(next, incoming.get(next) - 1);
      if (incoming.get(next) === 0) queue.push(next);
    }
  }
  if (order.length !== nodes.length) {
    throw new Error('workflow_cycle_detected');
  }
  return order.map(id => nodes.find(n => n.id === id));
}

async function executeNode(node, ctx, userId, runId) {
  const data = node.data || {};
  switch (node.type) {
    case 'input':
      log(runId, 'info', 'input received', node.id, { value: ctx.input });
      return { value: ctx.input };

    case 'agent': {
      const agent = getAgent(data.agentId, userId);
      if (!agent) throw new Error(`agent_not_found:${data.agentId}`);
      const prompt = resolveTemplate(data.prompt || '{{input}}', { ...ctx, input: ctx.input });
      log(runId, 'info', `calling agent ${agent.name}`, node.id, { prompt: prompt.slice(0, 500) });
      const result = await runAgent({ agent, userId, input: prompt });
      log(runId, 'info', 'agent responded', node.id, {
        tokens: result.promptTokens + result.completionTokens,
        durationMs: result.durationMs,
      });
      return {
        value: result.output,
        tokens: result.promptTokens + result.completionTokens,
      };
    }

    case 'condition': {
      const left = resolveTemplate(data.left ?? '{{prev}}', ctx);
      const right = resolveTemplate(data.right ?? '', ctx);
      const op = data.op || 'contains';
      let pass = false;
      if (op === 'equals') pass = left === right;
      else if (op === 'contains') pass = left.includes(right);
      else if (op === 'gt') pass = Number(left) > Number(right);
      else if (op === 'lt') pass = Number(left) < Number(right);
      log(runId, 'info', `condition ${op}: ${pass}`, node.id, { left, right });
      return { value: pass, skipped: !pass };
    }

    case 'transform': {
      const template = data.template || '{{prev}}';
      const value = resolveTemplate(template, ctx);
      log(runId, 'info', 'transform applied', node.id);
      return { value };
    }

    case 'log': {
      const message = resolveTemplate(data.message || '{{prev}}', ctx);
      log(runId, 'info', message, node.id);
      return { value: message };
    }

    case 'output':
      log(runId, 'info', 'output', node.id, { value: ctx.prev });
      return { value: ctx.prev };

    default:
      log(runId, 'warn', `unknown node type: ${node.type}`, node.id);
      return { value: ctx.prev };
  }
}

export async function runWorkflow({ workflow, userId, input }) {
  const runId = newId('wfr_');
  const started = Date.now();
  const inputText = typeof input === 'string' ? input : (input?.text ?? JSON.stringify(input));

  db.prepare(`INSERT INTO workflow_runs (id, workflow_id, user_id, status, input_json, started_at, tokens_used)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(runId, workflow.id, userId, 'running', JSON.stringify({ input: inputText }), started, 0);

  log(runId, 'info', `workflow "${workflow.name}" started`);

  const ctx = { input: inputText, prev: inputText, nodes: {} };
  let totalTokens = 0;
  let lastValue = inputText;

  try {
    const order = topoOrder(workflow.graph);
    if (order.length === 0) {
      log(runId, 'warn', 'workflow has no nodes; passing input through');
    }
    for (const node of order) {
      const result = await executeNode(node, ctx, userId, runId);
      ctx.nodes[node.id] = result.value;
      totalTokens += result.tokens || 0;
      if (result.skipped) {
        log(runId, 'info', `node ${node.id} skipped downstream`, node.id);
        break;
      }
      ctx.prev = result.value;
      lastValue = result.value;
    }

    const duration = Date.now() - started;
    db.prepare(`UPDATE workflow_runs SET status=?, output_json=?, finished_at=?, duration_ms=?, tokens_used=? WHERE id=?`)
      .run('success', JSON.stringify({ output: lastValue }), Date.now(), duration, totalTokens, runId);
    log(runId, 'info', `workflow finished in ${duration}ms (${totalTokens} tokens)`);

    return { runId, status: 'success', output: lastValue, durationMs: duration, tokensUsed: totalTokens };
  } catch (err) {
    const message = err?.message || String(err);
    const duration = Date.now() - started;
    db.prepare(`UPDATE workflow_runs SET status=?, error=?, finished_at=?, duration_ms=?, tokens_used=? WHERE id=?`)
      .run('error', message, Date.now(), duration, totalTokens, runId);
    log(runId, 'error', `workflow failed: ${message}`);
    return { runId, status: 'error', error: message, durationMs: duration, tokensUsed: totalTokens };
  }
}
