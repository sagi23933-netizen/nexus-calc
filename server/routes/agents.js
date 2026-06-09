import { Router } from 'express';
import { db } from '../db.js';
import { newId } from '../utils/crypto.js';
import { requireAuth } from '../middleware/auth.js';
import { runAgent } from '../ai/runner.js';

const router = Router();
router.use(requireAuth);

function rowToAgent(row) {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM agents WHERE user_id = ? ORDER BY created_at DESC').all(req.user.sub);
  res.json({ agents: rows.map(rowToAgent) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json({ agent: rowToAgent(row) });
});

router.post('/', (req, res) => {
  const {
    name, role, description, model = 'gpt-4o-mini', provider = 'openai',
    systemPrompt = '', tools = [], temperature = 0.7, maxTokens = 1024, status = 'active',
  } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name_required' });

  const now = Date.now();
  const id = newId('agt_');
  db.prepare(`INSERT INTO agents
    (id, user_id, name, role, description, model, provider, system_prompt, tools_json, status, temperature, max_tokens, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, req.user.sub, name, role || null, description || null,
    model, provider, systemPrompt, JSON.stringify(tools), status,
    temperature, maxTokens, now, now,
  );
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  res.status(201).json({ agent: rowToAgent(row) });
});

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const fields = {
    name: req.body.name ?? existing.name,
    role: req.body.role ?? existing.role,
    description: req.body.description ?? existing.description,
    model: req.body.model ?? existing.model,
    provider: req.body.provider ?? existing.provider,
    system_prompt: req.body.systemPrompt ?? existing.system_prompt,
    tools_json: req.body.tools ? JSON.stringify(req.body.tools) : existing.tools_json,
    status: req.body.status ?? existing.status,
    temperature: req.body.temperature ?? existing.temperature,
    max_tokens: req.body.maxTokens ?? existing.max_tokens,
    updated_at: Date.now(),
  };

  db.prepare(`UPDATE agents SET name=@name, role=@role, description=@description, model=@model,
              provider=@provider, system_prompt=@system_prompt, tools_json=@tools_json,
              status=@status, temperature=@temperature, max_tokens=@max_tokens, updated_at=@updated_at
              WHERE id=@id`).run({ ...fields, id: req.params.id });

  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  res.json({ agent: rowToAgent(row) });
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM agents WHERE id = ? AND user_id = ?').run(req.params.id, req.user.sub);
  if (r.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

router.post('/:id/run', async (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!agent) return res.status(404).json({ error: 'not_found' });
  const input = String(req.body?.input ?? '');
  if (!input.trim()) return res.status(400).json({ error: 'input_required' });

  try {
    const result = await runAgent({ agent: rowToAgent(agent), userId: req.user.sub, input });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'agent_run_failed', message: err?.message || String(err) });
  }
});

router.get('/:id/runs', (req, res) => {
  const agent = db.prepare('SELECT id FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!agent) return res.status(404).json({ error: 'not_found' });
  const rows = db.prepare('SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY created_at DESC LIMIT 100').all(req.params.id);
  res.json({ runs: rows });
});

export default router;
