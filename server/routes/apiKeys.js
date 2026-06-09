import { Router } from 'express';
import { db } from '../db.js';
import { encrypt, newId } from '../utils/crypto.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function mask(value) {
  if (!value) return '';
  const s = String(value);
  if (s.length <= 8) return '****';
  return `${s.slice(0, 3)}...${s.slice(-4)}`;
}

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT id, provider, label, last_used_at, created_at
                           FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`)
    .all(req.user.sub);
  res.json({ keys: rows });
});

router.post('/', (req, res) => {
  const { provider, key, label } = req.body || {};
  if (!provider || !key) return res.status(400).json({ error: 'provider_and_key_required' });
  const enc = encrypt(key);
  const id = newId('key_');
  db.prepare(`INSERT INTO api_keys (id, user_id, provider, label, ciphertext, iv, tag, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.user.sub, provider, label || null, enc.ciphertext, enc.iv, enc.tag, Date.now());
  res.status(201).json({ id, provider, label: label || null, preview: mask(key) });
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(req.params.id, req.user.sub);
  if (r.changes === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

export default router;
