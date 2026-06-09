import { Router } from 'express';
import { db } from '../db.js';
import { newId } from '../utils/crypto.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC').all(req.user.sub);
  res.json({ projects: rows });
});

router.post('/', (req, res) => {
  const { name, description, status = 'active' } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name_required' });
  const now = Date.now();
  const id = newId('prj_');
  db.prepare('INSERT INTO projects (id, user_id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.user.sub, name, description || null, status, now, now);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json({ project: row });
});

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const next = {
    name: req.body.name ?? existing.name,
    description: req.body.description ?? existing.description,
    status: req.body.status ?? existing.status,
    updated_at: Date.now(),
  };
  db.prepare('UPDATE projects SET name=@name, description=@description, status=@status, updated_at=@updated_at WHERE id=@id')
    .run({ ...next, id: req.params.id });
  res.json({ project: db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(req.params.id, req.user.sub);
  if (r.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

export default router;
