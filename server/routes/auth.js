import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { newId } from '../utils/crypto.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });
  if (String(password).length < 6) return res.status(400).json({ error: 'password_too_short' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (existing) return res.status(409).json({ error: 'email_taken' });

  const now = Date.now();
  const id = newId('usr_');
  const hash = bcrypt.hashSync(String(password), 10);
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const role = userCount === 0 ? 'admin' : 'member';

  db.prepare(`INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, String(email).toLowerCase(), name || null, hash, role, now, now);

  const token = signToken({ sub: id, email, role });
  res.json({ token, user: { id, email, name: name || null, role } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  if (!bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'user_not_found' });
  res.json({ user });
});

export default router;
