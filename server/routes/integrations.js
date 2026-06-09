import { Router } from 'express';
import { db } from '../db.js';
import { encrypt, newId } from '../utils/crypto.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT id, kind, name, status, created_at FROM integrations
                           WHERE user_id = ? ORDER BY created_at DESC`).all(req.user.sub);
  res.json({ integrations: rows });
});

router.post('/', (req, res) => {
  const { kind, name, config } = req.body || {};
  if (!kind || !name) return res.status(400).json({ error: 'kind_and_name_required' });
  const id = newId('int_');
  let cipher = { ciphertext: null, iv: null, tag: null };
  if (config) cipher = encrypt(JSON.stringify(config));
  db.prepare(`INSERT INTO integrations
    (id, user_id, kind, name, config_ciphertext, config_iv, config_tag, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'connected', ?)`)
    .run(id, req.user.sub, kind, name, cipher.ciphertext, cipher.iv, cipher.tag, Date.now());
  res.status(201).json({ id, kind, name, status: 'connected' });
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM integrations WHERE id = ? AND user_id = ?').run(req.params.id, req.user.sub);
  if (r.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

export default router;
