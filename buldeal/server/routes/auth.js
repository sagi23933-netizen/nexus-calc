import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { one, run, tx } from '../db.js';
import { checkPassword, clearSession, hashPassword, requireRole, setSession } from '../lib/auth.js';
import { addDays, addHours, bad, email, HttpError, nowIso, num, password, phone, randomId, sha256, slugify, str, todayIL } from '../lib/utils.js';
import { getSection } from '../services/settings.js';
import { notifyAdmins, notifyBusiness, sendEmail, audit } from '../services/notify.js';
import { recordEvent } from '../services/analytics.js';
import { config } from '../config.js';
import { businessPayload } from '../services/businessView.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 25, standardHeaders: true, legacyHeaders: false, message: { error: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.' } });

export function uniqueSlug(name) {
  const base = slugify(name);
  let slug = base;
  let i = 2;
  while (one('SELECT id FROM businesses WHERE slug = ?', slug)) slug = `${base}-${i++}`;
  return slug;
}

/** Creates the owner user + business with a trial. Used by self sign-up and by the admin. */
export const createBusinessAccount = tx((data, { source, trialDays, passwordHash, mustChangePassword = false }) => {
  const now = nowIso();
  if (one('SELECT id FROM users WHERE email = ?', data.email)) throw bad('כתובת האימייל כבר רשומה במערכת', 'EMAIL_TAKEN');
  const u = run(
    'INSERT INTO users(email, password_hash, role, name, phone, must_change_password, created_at) VALUES (?,?,?,?,?,?,?)',
    data.email, passwordHash, 'business', data.ownerName, data.phone, mustChangePassword ? 1 : 0, now,
  );
  const b = run(
    `INSERT INTO businesses(user_id, name, slug, category_id, city_id, phone, address, description, status, source, trial_days, trial_started_at, trial_ends_at,
       package_id, daily_tokens, daily_tokens_date, token_balance, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    u.lastInsertRowid, data.businessName, uniqueSlug(data.businessName), data.categoryId, data.cityId, data.phone, data.address || '', data.description || '',
    'trial', source, trialDays, now, addDays(now, trialDays), data.packageId || null, getSection('trial').dailyTokens, todayIL(), data.initialTokens || 0, now, now,
  );
  const daily = getSection('trial').dailyTokens;
  if (daily > 0) {
    run(
      'INSERT INTO token_transactions(business_id, amount, balance_after, pool, type, note, created_at) VALUES (?,?,?,?,?,?,?)',
      b.lastInsertRowid, daily, daily, 'daily', 'trial_daily', 'טוקן יומי – תקופת ניסיון', now,
    );
  }
  return { userId: u.lastInsertRowid, businessId: b.lastInsertRowid };
});

router.post('/register', authLimiter, async (req, res) => {
  const body = req.body || {};
  const data = {
    businessName: str(body.businessName, { field: 'שם העסק', required: true, min: 2, max: 80 }),
    ownerName: str(body.ownerName, { field: 'שם מלא', required: true, min: 2, max: 80 }),
    email: email(body.email),
    phone: phone(body.phone, { required: true }),
    categoryId: num(body.categoryId, { field: 'קטגוריה', required: true, int: true }),
    cityId: num(body.cityId, { field: 'עיר', required: true, int: true }),
    address: str(body.address, { field: 'כתובת', max: 160 }),
  };
  const pw = password(body.password);
  if (!body.acceptTerms) throw bad('יש לאשר את תנאי השימוש');
  if (!one('SELECT id FROM categories WHERE id = ? AND is_active = 1', data.categoryId)) throw bad('קטגוריה לא חוקית');
  if (!one('SELECT id FROM cities WHERE id = ? AND is_active = 1', data.cityId)) throw bad('עיר לא חוקית');
  const passwordHash = await hashPassword(pw);
  const trialDays = getSection('trial').siteDays;
  const { userId, businessId } = createBusinessAccount(data, { source: 'site', trialDays, passwordHash });
  const user = one('SELECT * FROM users WHERE id = ?', userId);
  setSession(res, user);
  recordEvent(req, { type: 'signup', path: '/register', businessId, categoryId: data.categoryId, cityId: data.cityId });
  notifyBusiness(businessId, {
    type: 'welcome',
    title: `ברוכים הבאים לבולדיל! 🎉`,
    body: `קיבלתם ${trialDays} ימי ניסיון חינם, עם טוקן אחד לפרסום בכל יום. בחרו חבילה שתמשיך אחרי תקופת הניסיון — ללא צורך בכרטיס אשראי עכשיו.`,
    link: '/dashboard',
  });
  notifyAdmins({ type: 'signup', title: `עסק חדש נרשם: ${data.businessName}`, body: `${data.ownerName} · ${data.phone}`, link: `/admin/businesses/${businessId}` });
  sendEmail(data.email, 'ברוכים הבאים לבולדיל', `שלום ${data.ownerName},\nהחשבון של "${data.businessName}" נוצר בהצלחה ותקופת הניסיון התחילה.`, '/dashboard');
  res.status(201).json({ ok: true, next: '/choose-package' });
});

router.post('/login', authLimiter, async (req, res) => {
  const mail = email(req.body?.email);
  const user = one('SELECT * FROM users WHERE email = ?', mail);
  const ok = user && (await checkPassword(req.body?.password, user.password_hash));
  if (!ok) throw new HttpError(401, 'אימייל או סיסמה שגויים');
  if (!user.is_active) throw new HttpError(403, 'המשתמש מושבת. פנו לתמיכה.');
  if (req.body?.role && req.body.role !== user.role) throw new HttpError(403, user.role === 'admin' ? 'זהו חשבון ניהול — התחברו דרך מסך הניהול' : 'חשבון זה אינו חשבון ניהול');
  run('UPDATE users SET last_login_at = ? WHERE id = ?', nowIso(), user.id);
  setSession(res, user);
  req.user = user;
  if (user.role === 'admin') audit(req, 'login', 'user', user.id);
  res.json({ ok: true, role: user.role });
});

router.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  const out = { user: { id: req.user.id, email: req.user.email, role: req.user.role, name: req.user.name, phone: req.user.phone, mustChangePassword: !!req.user.must_change_password } };
  if (req.business) out.business = businessPayload(req.business.id);
  res.json(out);
});

router.post('/change-password', async (req, res) => {
  if (!req.user) throw new HttpError(401, 'יש להתחבר');
  const user = one('SELECT * FROM users WHERE id = ?', req.user.id);
  if (!(await checkPassword(req.body?.currentPassword, user.password_hash))) throw bad('הסיסמה הנוכחית שגויה');
  const pw = password(req.body?.newPassword);
  if (pw === String(req.body?.currentPassword)) throw bad('הסיסמה החדשה חייבת להיות שונה מהנוכחית');
  const hash = await hashPassword(pw);
  run('UPDATE users SET password_hash = ?, must_change_password = 0, token_version = token_version + 1 WHERE id = ?', hash, user.id);
  setSession(res, { ...user, token_version: user.token_version + 1 });
  res.json({ ok: true });
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  const mail = email(req.body?.email);
  const user = one('SELECT id, name, email FROM users WHERE email = ? AND is_active = 1', mail);
  if (user) {
    const token = randomId(24);
    run('INSERT INTO password_resets(token_hash, user_id, expires_at) VALUES (?,?,?)', sha256(token), user.id, addHours(nowIso(), 2));
    const sent = await sendEmail(user.email, 'איפוס סיסמה — בולדיל', `שלום ${user.name},\nלאיפוס הסיסמה לחצו על הקישור (בתוקף לשעתיים):\n${config.publicUrl}/reset-password?token=${token}`, `/reset-password?token=${token}`);
    if (!sent) {
      // no email configured — open a support ticket so an admin can reset manually
      const now = nowIso();
      const biz = one('SELECT id, name FROM businesses WHERE user_id = ?', user.id);
      const t = run(`INSERT INTO tickets(business_id, name, email, subject, source, status, unread_admin, last_message_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)`, biz?.id ?? null, user.name, user.email, 'בקשת איפוס סיסמה', 'site', 'open', 1, now, now);
      run(`INSERT INTO ticket_messages(ticket_id, sender, body, created_at) VALUES (?,?,?,?)`, t.lastInsertRowid, 'guest', `המשתמש ${user.email} ביקש לאפס סיסמה.`, now);
      notifyAdmins({ type: 'ticket', title: `בקשת איפוס סיסמה: ${user.email}`, link: `/admin/support?ticket=${t.lastInsertRowid}` });
    }
  }
  res.json({ ok: true });
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const token = String(req.body?.token || '');
  const row = one('SELECT * FROM password_resets WHERE token_hash = ?', sha256(token));
  if (!row || row.used_at || row.expires_at < nowIso()) throw bad('הקישור לאיפוס אינו בתוקף');
  const pw = password(req.body?.password);
  const hash = await hashPassword(pw);
  run('UPDATE users SET password_hash = ?, must_change_password = 0, token_version = token_version + 1 WHERE id = ?', hash, row.user_id);
  run('UPDATE password_resets SET used_at = ? WHERE token_hash = ?', nowIso(), row.token_hash);
  res.json({ ok: true });
});

/** After sign-up the owner must pick the package that continues after the trial (no card needed yet). */
router.post('/choose-package', requireRole('business'), (req, res) => {
  const packageId = num(req.body?.packageId, { field: 'חבילה', required: true, int: true });
  const pkg = one(`SELECT * FROM packages WHERE id = ? AND kind = 'subscription' AND is_active = 1`, packageId);
  if (!pkg) throw bad('החבילה לא נמצאה');
  run('UPDATE businesses SET package_id = ?, updated_at = ? WHERE id = ?', pkg.id, nowIso(), req.business.id);
  notifyBusiness(req.business.id, {
    type: 'billing',
    title: `בחרת בחבילת ${pkg.name}`,
    body: req.business.status === 'trial' ? 'החבילה תופעל בתום תקופת הניסיון, לאחר הזנת אמצעי תשלום. ניתן לשנות חבילה בכל עת.' : 'ניתן להשלים תשלום במסך החבילות.',
    link: '/dashboard/billing',
  });
  res.json({ ok: true, business: businessPayload(req.business.id) });
});

export default router;
