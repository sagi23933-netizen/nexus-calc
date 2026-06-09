import { Router } from 'express';
import { db } from '../db.js';
import { newId } from '../utils/crypto.js';
import { requireAuth } from '../middleware/auth.js';
import { runWorkflow } from '../ai/workflow.js';

const router = Router();
router.use(requireAuth);

function rowToWorkflow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    graph: JSON.parse(row.graph_json || '{"nodes":[],"edges":[]}'),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM workflows WHERE user_id = ? ORDER BY created_at DESC').all(req.user.sub);
  res.json({ workflows: rows.map(rowToWorkflow) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM workflows WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json({ workflow: rowToWorkflow(row) });
});

router.post('/', (req, res) => {
  const { name, description, projectId = null, graph = { nodes: [], edges: [] }, status = 'draft' } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name_required' });
  const now = Date.now();
  const id = newId('wf_');
  db.prepare(`INSERT INTO workflows (id, user_id, project_id, name, description, graph_json, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, req.user.sub, projectId, name, description || null, JSON.stringify(graph), status, now, now,
  );
  res.status(201).json({ workflow: rowToWorkflow(db.prepare('SELECT * FROM workflows WHERE id = ?').get(id)) });
});

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM workflows WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const next = {
    name: req.body.name ?? existing.name,
    description: req.body.description ?? existing.description,
    project_id: req.body.projectId ?? existing.project_id,
    graph_json: req.body.graph ? JSON.stringify(req.body.graph) : existing.graph_json,
    status: req.body.status ?? existing.status,
    updated_at: Date.now(),
  };
  db.prepare(`UPDATE workflows SET name=@name, description=@description, project_id=@project_id,
              graph_json=@graph_json, status=@status, updated_at=@updated_at WHERE id=@id`)
    .run({ ...next, id: req.params.id });
  res.json({ workflow: rowToWorkflow(db.prepare('SELECT * FROM workflows WHERE id = ?').get(req.params.id)) });
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM workflows WHERE id = ? AND user_id = ?').run(req.params.id, req.user.sub);
  if (r.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

router.post('/:id/run', async (req, res) => {
  const row = db.prepare('SELECT * FROM workflows WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!row) return res.status(404).json({ error: 'not_found' });
  try {
    const result = await runWorkflow({
      workflow: rowToWorkflow(row),
      userId: req.user.sub,
      input: req.body?.input ?? {},
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'workflow_run_failed', message: err?.message || String(err) });
  }
});

router.get('/:id/runs', (req, res) => {
  const wf = db.prepare('SELECT id FROM workflows WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!wf) return res.status(404).json({ error: 'not_found' });
  const runs = db.prepare('SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT 100')
    .all(req.params.id);
  res.json({ runs });
});

router.get('/runs/:runId/logs', (req, res) => {
  const run = db.prepare(`SELECT r.* FROM workflow_runs r WHERE r.id = ? AND r.user_id = ?`)
    .get(req.params.runId, req.user.sub);
  if (!run) return res.status(404).json({ error: 'not_found' });
  const logs = db.prepare('SELECT * FROM run_logs WHERE run_id = ? ORDER BY created_at ASC').all(req.params.runId);
  res.json({ run, logs });
});

export default router;
