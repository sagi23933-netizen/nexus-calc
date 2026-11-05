import { Router } from 'express';
import ExcelJS from 'exceljs';
import { all, one, run, tx } from '../db.js';
import { hashPassword, requireRole } from '../lib/auth.js';
import { imageUpload, uploadedUrl } from '../lib/upload.js';
import {
  addDays, bad, bool, csvEscape, startOfDayIL, email, notFound, nowIso, num, oneOf, pageParams, password, phone, randomId, slugify, str, todayIL, url,
} from '../lib/utils.js';
import { getSection, maskedSettings, updateSection, DEFAULT_SETTINGS } from '../services/settings.js';
import { businessPayload } from '../services/businessView.js';
import { cleanPackageContent, serializePackage } from '../services/packages.js';
import { DEAL_SELECT, archiveDeal, archiveBusinessDeals, deleteUpload, serializeDeal } from '../services/deals.js';
import { adjustTokens } from '../services/tokens.js';
import { refundPayment } from '../services/billing.js';
import { CLAUDE_MODELS, DEFAULT_SYSTEM_PROMPT, EFFORTS, designDeal, publicModel, testModel } from '../services/ai.js';
import { analyticsReport, eventsExport, DAY } from '../services/analytics.js';
import { audit, notifyBusiness, sendEmail, verifyEmailTransport } from '../services/notify.js';
import { runJobs } from '../services/scheduler.js';
import { createBusinessAccount, uniqueSlug } from './auth.js';

const router = Router();
router.use(requireRole('admin'));

// ======================= dashboard =======================
router.get('/dashboard', (_req, res) => {
  const now = nowIso();
  const monthStart = startOfDayIL(`${todayIL().slice(0, 7)}-01`);
  const biz = one(
    `SELECT COUNT(*) AS total, SUM(status = 'trial') AS trial, SUM(status = 'active') AS active, SUM(status = 'past_due') AS past_due,
            SUM(status = 'blocked') AS blocked, SUM(status = 'suspended') AS suspended, SUM(created_at >= ?) AS new_week
     FROM businesses`,
    addDays(now, -7),
  );
  const deals = one(`SELECT COUNT(*) AS live, SUM(status = 'scheduled') AS scheduled, SUM(expires_at <= ?) AS ending_soon FROM deals`, addDays(now, 0.25));
  const revenue = one(
    `SELECT COALESCE(SUM(CASE WHEN created_at >= ? THEN amount END),0) AS month, COALESCE(SUM(CASE WHEN created_at >= ? THEN amount END),0) AS week,
            COALESCE(SUM(amount),0) AS total FROM payments WHERE status = 'paid'`,
    monthStart, addDays(now, -7),
  );
  const mrr = one(
    `SELECT COALESCE(SUM(CASE p.period WHEN 'year' THEN p.price / 12.0 ELSE p.price END), 0) AS mrr
     FROM businesses b JOIN packages p ON p.id = b.package_id WHERE b.status = 'active'`,
  ).mrr;
  const visits = one(
    `SELECT SUM(type = 'pageview' AND created_at >= ?) AS today, SUM(type = 'pageview') AS week,
            COUNT(DISTINCT CASE WHEN type = 'pageview' THEN visitor_id END) AS visitors_week FROM analytics_events WHERE created_at >= ?`,
    startOfDayIL(), addDays(now, -7),
  );
  const live = one(`SELECT COUNT(DISTINCT visitor_id) AS n FROM analytics_events WHERE created_at >= ?`, new Date(Date.now() - 5 * 60_000).toISOString()).n;
  const feedback = one(`SELECT SUM(feedback = 'yes') AS yes, SUM(feedback = 'no') AS no, SUM(feedback IS NULL AND end_reason = 'expired') AS pending FROM deal_history`);
  const series = all(
    `SELECT ${DAY()} AS day, SUM(type = 'pageview') AS views, COUNT(DISTINCT CASE WHEN type = 'pageview' THEN visitor_id END) AS visitors,
            SUM(type IN ('deal_phone','deal_waze')) AS clicks
     FROM analytics_events WHERE created_at >= ? GROUP BY day ORDER BY day`,
    addDays(now, -29),
  );
  const revenueSeries = all(
    `SELECT ${DAY()} AS day, SUM(amount) AS amount FROM payments WHERE status = 'paid' AND created_at >= ? GROUP BY day ORDER BY day`,
    addDays(now, -29),
  );
  const trialsEnding = all(
    `SELECT b.id, b.name, b.trial_ends_at, p.name AS package_name FROM businesses b LEFT JOIN packages p ON p.id = b.package_id
     WHERE b.status = 'trial' ORDER BY b.trial_ends_at LIMIT 8`,
  );
  const recentBusinesses = all(
    `SELECT b.id, b.name, b.status, b.source, b.created_at, b.logo_url, c.name AS category, ci.name AS city FROM businesses b
     LEFT JOIN categories c ON c.id = b.category_id LEFT JOIN cities ci ON ci.id = b.city_id ORDER BY b.id DESC LIMIT 6`,
  );
  const topDeals = all(`${DEAL_SELECT} ORDER BY (d.views + d.clicks_phone * 5 + d.clicks_waze * 5) DESC LIMIT 5`).map((r) => serializeDeal(r, { includeStats: true }));
  const openTickets = one(`SELECT COUNT(*) AS n FROM tickets WHERE status != 'closed'`).n;
  const notifications = all(`SELECT * FROM notifications WHERE audience = 'admin' ORDER BY id DESC LIMIT 12`);
  const ai = one(`SELECT COUNT(*) AS calls, SUM(success) AS ok FROM ai_logs WHERE created_at >= ?`, addDays(now, -7));
  res.json({ biz, deals, revenue: { ...revenue, mrr }, visits: { ...visits, live }, feedback, series, revenueSeries, trialsEnding, recentBusinesses, topDeals, openTickets, notifications, ai });
});

router.get('/notifications', (_req, res) => {
  const items = all(`SELECT * FROM notifications WHERE audience = 'admin' ORDER BY id DESC LIMIT 200`);
  res.json({ items, unread: items.filter((n) => !n.read_at).length });
});
router.post('/notifications/read', (_req, res) => {
  run(`UPDATE notifications SET read_at = ? WHERE audience = 'admin' AND read_at IS NULL`, nowIso());
  res.json({ ok: true });
});

router.get('/badges', (_req, res) => {
  res.json({
    tickets: one(`SELECT COUNT(*) AS n FROM tickets WHERE status != 'closed' AND unread_admin > 0`).n,
    notifications: one(`SELECT COUNT(*) AS n FROM notifications WHERE audience = 'admin' AND read_at IS NULL`).n,
    trialsEnding: one(`SELECT COUNT(*) AS n FROM businesses WHERE status = 'trial' AND trial_ends_at <= ?`, addDays(nowIso(), 1)).n,
  });
});

// ======================= businesses =======================
const BIZ_STATUSES = ['trial', 'active', 'past_due', 'blocked', 'suspended'];

router.get('/businesses', (req, res) => {
  const { page, size, offset } = pageParams(req.query, 25);
  const where = ['1=1'];
  const params = [];
  if (req.query.q) {
    const q = `%${String(req.query.q).slice(0, 60)}%`;
    where.push('(b.name LIKE ? OR u.email LIKE ? OR b.phone LIKE ? OR u.name LIKE ?)');
    params.push(q, q, q, q);
  }
  if (BIZ_STATUSES.includes(req.query.status)) {
    where.push('b.status = ?');
    params.push(req.query.status);
  }
  if (req.query.city) {
    where.push('b.city_id = ?');
    params.push(Number(req.query.city));
  }
  if (req.query.category) {
    where.push('b.category_id = ?');
    params.push(Number(req.query.category));
  }
  if (['site', 'admin'].includes(req.query.source)) {
    where.push('b.source = ?');
    params.push(req.query.source);
  }
  const sort = { name: 'b.name', trial: 'b.trial_ends_at', tokens: 'b.token_balance DESC', created: 'b.id DESC' }[req.query.sort] || 'b.id DESC';
  const base = `FROM businesses b JOIN users u ON u.id = b.user_id LEFT JOIN categories c ON c.id = b.category_id LEFT JOIN cities ci ON ci.id = b.city_id
                LEFT JOIN packages p ON p.id = b.package_id WHERE ${where.join(' AND ')}`;
  const items = all(
    `SELECT b.id, b.name, b.slug, b.logo_url, b.status, b.source, b.phone, b.trial_ends_at, b.period_end, b.token_balance, b.daily_tokens, b.created_at,
            u.email, u.name AS owner, c.name AS category, ci.name AS city, p.name AS package_name,
            (SELECT COUNT(*) FROM deals d WHERE d.business_id = b.id) AS live_deals
     ${base} ORDER BY ${sort} LIMIT ? OFFSET ?`,
    ...params, size, offset,
  );
  const total = one(`SELECT COUNT(*) AS n ${base}`, ...params).n;
  res.json({ items, total, page, size });
});

router.post('/businesses', async (req, res) => {
  const body = req.body || {};
  const trialDays = num(body.trialDays, { field: 'ימי ניסיון', min: 0, max: 3650, int: true }) ?? getSection('trial').adminDays;
  const data = {
    businessName: str(body.businessName, { field: 'שם העסק', required: true, min: 2, max: 80 }),
    ownerName: str(body.ownerName, { field: 'שם בעל העסק', required: true, max: 80 }),
    email: email(body.email),
    phone: phone(body.phone, { required: true }),
    categoryId: num(body.categoryId, { field: 'קטגוריה', required: true, int: true }),
    cityId: num(body.cityId, { field: 'עיר', required: true, int: true }),
    address: str(body.address, { field: 'כתובת', max: 160 }),
    description: str(body.description, { field: 'תיאור', max: 600 }),
    packageId: num(body.packageId, { field: 'חבילה', int: true }),
    initialTokens: num(body.initialTokens, { field: 'טוקנים', min: 0, max: 10000, int: true }) || 0,
  };
  const tempPassword = body.password ? password(body.password) : `Bd${randomId(4)}9`;
  const passwordHash = await hashPassword(tempPassword);
  const { businessId } = createBusinessAccount(data, { source: 'admin', trialDays, passwordHash, mustChangePassword: !body.password });
  if (data.initialTokens) run(`INSERT INTO token_transactions(business_id, amount, balance_after, pool, type, note, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)`, businessId, data.initialTokens, data.initialTokens, 'balance', 'admin_adjust', 'טוקנים התחלתיים מהמנהל', req.user.id, nowIso());
  notifyBusiness(businessId, { type: 'welcome', title: 'החשבון שלך בבולדיל מוכן 🎉', body: `הוקצו לך ${trialDays} ימי ניסיון חינם. התחברו והתחילו לפרסם דילים.`, link: '/dashboard' });
  if (body.sendEmail) {
    sendEmail(data.email, 'החשבון שלך בבולדיל מוכן', `שלום ${data.ownerName},\nנפתח עבורך חשבון לעסק "${data.businessName}" עם ${trialDays} ימי ניסיון.\nאימייל: ${data.email}\nסיסמה זמנית: ${tempPassword}`, '/login');
  }
  audit(req, 'business.create', 'business', businessId, { name: data.businessName, trialDays });
  res.status(201).json({ id: businessId, tempPassword: body.password ? null : tempPassword });
});

router.get('/businesses/:id', (req, res) => {
  const id = Number(req.params.id);
  const business = businessPayload(id);
  if (!business) throw notFound('העסק לא נמצא');
  const raw = one('SELECT admin_notes, user_id FROM businesses WHERE id = ?', id);
  const owner = one('SELECT id, name, email, phone, last_login_at, is_active, must_change_password, created_at FROM users WHERE id = ?', raw.user_id);
  const deals = all(`${DEAL_SELECT} WHERE d.business_id = ? ORDER BY d.expires_at`, id).map((r) => serializeDeal(r, { includeStats: true }));
  const history = all('SELECT * FROM deal_history WHERE business_id = ? ORDER BY ended_at DESC LIMIT 50', id);
  const payments = all('SELECT * FROM payments WHERE business_id = ? ORDER BY id DESC LIMIT 50', id);
  const tokens = all('SELECT * FROM token_transactions WHERE business_id = ? ORDER BY id DESC LIMIT 50', id);
  const tickets = all('SELECT * FROM tickets WHERE business_id = ? ORDER BY last_message_at DESC LIMIT 20', id);
  const stats = one(
    `SELECT COUNT(*) AS deals, COALESCE(SUM(views),0) AS views, COALESCE(SUM(clicks_phone + clicks_waze),0) AS clicks, SUM(feedback = 'yes') AS helped, SUM(feedback IS NOT NULL) AS answered
     FROM deal_history WHERE business_id = ?`,
    id,
  );
  const revenue = one(`SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE business_id = ? AND status = 'paid'`, id).total;
  res.json({ business: { ...business, admin_notes: raw.admin_notes }, owner, deals, history, payments, tokens, tickets, stats: { ...stats, revenue } });
});

router.put('/businesses/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = one('SELECT * FROM businesses WHERE id = ?', id);
  if (!b) throw notFound('העסק לא נמצא');
  const body = req.body || {};
  const data = {
    name: str(body.name, { field: 'שם העסק', required: true, min: 2, max: 80 }),
    description: str(body.description, { field: 'תיאור', max: 600 }),
    phone: phone(body.phone, { required: true }),
    whatsapp: phone(body.whatsapp, { field: 'וואטסאפ' }),
    address: str(body.address, { field: 'כתובת', max: 160 }),
    waze_url: url(body.waze_url, { field: 'קישור Waze' }),
    website: url(body.website, { field: 'אתר' }),
    instagram: str(body.instagram, { max: 120 }),
    category_id: num(body.category_id, { field: 'קטגוריה', int: true }),
    city_id: num(body.city_id, { field: 'עיר', int: true }),
    admin_notes: str(body.admin_notes, { field: 'הערות', max: 4000 }),
    slug: body.slug ? slugify(body.slug) : b.slug,
    package_id: num(body.package_id, { field: 'חבילה', int: true }),
  };
  if (data.slug !== b.slug && one('SELECT id FROM businesses WHERE slug = ? AND id != ?', data.slug, id)) throw bad('כתובת העסק (slug) כבר תפוסה');
  const keys = Object.keys(data);
  run(`UPDATE businesses SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => data[k]), nowIso(), id);
  if (body.ownerName || body.ownerEmail || body.ownerPhone) {
    const u = one('SELECT * FROM users WHERE id = ?', b.user_id);
    const newEmail = body.ownerEmail ? email(body.ownerEmail) : u.email;
    if (newEmail !== u.email && one('SELECT id FROM users WHERE email = ? AND id != ?', newEmail, u.id)) throw bad('האימייל כבר בשימוש');
    run('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?', str(body.ownerName, { max: 80 }) || u.name, newEmail, phone(body.ownerPhone) || u.phone, u.id);
  }
  audit(req, 'business.update', 'business', id);
  res.json({ business: businessPayload(id) });
});

router.post('/businesses/:id/logo', (req, res, next) => {
  const id = Number(req.params.id);
  const b = one('SELECT id, logo_url FROM businesses WHERE id = ?', id);
  if (!b) return next(notFound('העסק לא נמצא'));
  imageUpload(req, res, (err) => {
    if (err) return next(err.status ? err : bad(err.message));
    if (!req.file) return next(bad('לא נבחר קובץ'));
    run('UPDATE businesses SET logo_url = ?, updated_at = ? WHERE id = ?', uploadedUrl(req.file), nowIso(), id);
    deleteUpload(b.logo_url);
    res.json({ business: businessPayload(id) });
  });
});

router.post('/businesses/:id/tokens', (req, res) => {
  const id = Number(req.params.id);
  if (!one('SELECT id FROM businesses WHERE id = ?', id)) throw notFound('העסק לא נמצא');
  const amount = num(req.body?.amount, { field: 'כמות', required: true, int: true, min: -10000, max: 10000 });
  if (!amount) throw bad('יש להזין כמות שונה מאפס');
  const note = str(req.body?.note, { max: 200 }) || (amount > 0 ? 'הוספת טוקנים על ידי מנהל' : 'הפחתת טוקנים על ידי מנהל');
  const balance = adjustTokens(id, amount, 'admin_adjust', note, { userId: req.user.id });
  if (amount > 0) notifyBusiness(id, { type: 'tokens', title: `קיבלת ${amount} טוקנים במתנה 🎁`, body: note, link: '/dashboard/billing' });
  audit(req, 'business.tokens', 'business', id, { amount, note });
  res.json({ balance, business: businessPayload(id) });
});

/** Change trial length or end date (default 30 days for admin-created businesses). */
router.post('/businesses/:id/trial', (req, res) => {
  const id = Number(req.params.id);
  const b = one('SELECT * FROM businesses WHERE id = ?', id);
  if (!b) throw notFound('העסק לא נמצא');
  let endsAt;
  if (req.body?.endsAt) {
    const d = new Date(req.body.endsAt);
    if (Number.isNaN(d.getTime())) throw bad('תאריך לא תקין');
    endsAt = d.toISOString();
  } else {
    const days = num(req.body?.days, { field: 'ימים', required: true, min: 0, max: 3650 });
    endsAt = addDays(b.trial_started_at || nowIso(), days);
  }
  const days = Math.max(0, Math.round((new Date(endsAt) - new Date(b.trial_started_at || nowIso())) / 86400_000));
  const reactivate = ['blocked', 'trial'].includes(b.status) && endsAt > nowIso() && !b.period_end;
  run(
    `UPDATE businesses SET trial_ends_at = ?, trial_days = ?, trial_warning_sent = 0 ${reactivate ? `, status = 'trial', blocked_reason = ''` : ''}, updated_at = ? WHERE id = ?`,
    endsAt, days, nowIso(), id,
  );
  notifyBusiness(id, { type: 'trial', title: 'תקופת הניסיון עודכנה', body: `תקופת הניסיון שלך מסתיימת כעת ב-${new Date(endsAt).toLocaleDateString('he-IL')}.`, link: '/dashboard/billing' });
  audit(req, 'business.trial', 'business', id, { endsAt });
  res.json({ business: businessPayload(id) });
});

router.post('/businesses/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const b = one('SELECT * FROM businesses WHERE id = ?', id);
  if (!b) throw notFound('העסק לא נמצא');
  const status = oneOf(req.body?.status, BIZ_STATUSES, { field: 'סטטוס' });
  const reason = str(req.body?.reason, { max: 200 });
  const extra = {};
  if (status === 'active' && !b.period_end) {
    // manual activation without payment (e.g. paid offline) — one period from now
    const days = num(req.body?.days, { min: 1, max: 3650 }) || 30;
    extra.period_start = nowIso();
    extra.period_end = addDays(nowIso(), days);
  }
  const keys = Object.keys(extra);
  run(
    `UPDATE businesses SET status = ?, blocked_reason = ?, past_due_since = NULL ${keys.map((k) => `, ${k} = ?`).join('')}, updated_at = ? WHERE id = ?`,
    status, ['blocked', 'suspended'].includes(status) ? reason || 'admin' : '', ...keys.map((k) => extra[k]), nowIso(), id,
  );
  if (['blocked', 'suspended'].includes(status)) archiveBusinessDeals(id, 'blocked');
  const titles = { active: 'החשבון הופעל', trial: 'החשבון הוחזר לתקופת ניסיון', blocked: 'החשבון נחסם', suspended: 'החשבון הושעה', past_due: 'החשבון ממתין לתשלום' };
  notifyBusiness(id, { type: status === 'active' ? 'billing' : 'blocked', title: titles[status], body: reason, link: '/dashboard' }, { email: ['blocked', 'suspended', 'active'].includes(status) });
  audit(req, 'business.status', 'business', id, { status, reason });
  res.json({ business: businessPayload(id) });
});

router.post('/businesses/:id/reset-password', async (req, res) => {
  const id = Number(req.params.id);
  const b = one('SELECT user_id FROM businesses WHERE id = ?', id);
  if (!b) throw notFound('העסק לא נמצא');
  const temp = req.body?.password ? password(req.body.password) : `Bd${randomId(4)}9`;
  run('UPDATE users SET password_hash = ?, must_change_password = ?, token_version = token_version + 1 WHERE id = ?', await hashPassword(temp), req.body?.password ? 0 : 1, b.user_id);
  audit(req, 'business.reset_password', 'business', id);
  res.json({ password: temp });
});

router.post('/businesses/:id/notify', (req, res) => {
  const id = Number(req.params.id);
  if (!one('SELECT id FROM businesses WHERE id = ?', id)) throw notFound();
  const title = str(req.body?.title, { field: 'כותרת', required: true, max: 120 });
  const body = str(req.body?.body, { field: 'תוכן', max: 2000 });
  notifyBusiness(id, { type: 'admin', title, body, link: '/dashboard/notifications' }, { email: bool(req.body?.email) });
  res.json({ ok: true });
});

router.delete('/businesses/:id', (req, res) => {
  const id = Number(req.params.id);
  const b = one('SELECT * FROM businesses WHERE id = ?', id);
  if (!b) throw notFound();
  if (req.body?.confirm !== b.name) throw bad('לאישור המחיקה יש להקליד את שם העסק');
  tx(() => {
    for (const d of all('SELECT image_url FROM deals WHERE business_id = ?', id)) deleteUpload(d.image_url);
    deleteUpload(b.logo_url);
    run('DELETE FROM users WHERE id = ?', b.user_id); // cascades to the business and its data
  })();
  audit(req, 'business.delete', 'business', id, { name: b.name });
  res.json({ ok: true });
});

// ======================= deals =======================
router.get('/deals', (req, res) => {
  const where = ['1=1'];
  const params = [];
  if (req.query.q) {
    const q = `%${String(req.query.q).slice(0, 60)}%`;
    where.push('(d.title LIKE ? OR b.name LIKE ?)');
    params.push(q, q);
  }
  if (req.query.city) {
    where.push('b.city_id = ?');
    params.push(Number(req.query.city));
  }
  if (req.query.category) {
    where.push('b.category_id = ?');
    params.push(Number(req.query.category));
  }
  const rows = all(`${DEAL_SELECT} WHERE ${where.join(' AND ')} ORDER BY d.expires_at LIMIT 300`, ...params);
  res.json({ deals: rows.map((r) => ({ ...serializeDeal(r, { includeStats: true }), business_status: r.biz_status })), serverTime: nowIso() });
});

router.get('/deals/history', (req, res) => {
  const { page, size, offset } = pageParams(req.query, 30);
  const where = ['1=1'];
  const params = [];
  if (['yes', 'no'].includes(req.query.feedback)) {
    where.push('h.feedback = ?');
    params.push(req.query.feedback);
  } else if (req.query.feedback === 'none') where.push('h.feedback IS NULL');
  if (req.query.q) {
    const q = `%${String(req.query.q).slice(0, 60)}%`;
    where.push('(h.title LIKE ? OR b.name LIKE ?)');
    params.push(q, q);
  }
  const base = `FROM deal_history h JOIN businesses b ON b.id = h.business_id LEFT JOIN cities ci ON ci.id = h.city_id LEFT JOIN categories c ON c.id = h.category_id WHERE ${where.join(' AND ')}`;
  const items = all(`SELECT h.*, b.name AS business, ci.name AS city, c.name AS category ${base} ORDER BY h.ended_at DESC LIMIT ? OFFSET ?`, ...params, size, offset);
  const total = one(`SELECT COUNT(*) AS n ${base}`, ...params).n;
  const summary = one(`SELECT SUM(feedback = 'yes') AS yes, SUM(feedback = 'no') AS no, SUM(feedback IS NULL) AS none, COALESCE(SUM(feedback_customers),0) AS customers FROM deal_history`);
  res.json({ items, total, page, size, summary });
});

router.delete('/deals/:id', (req, res) => {
  const d = one('SELECT id, business_id, title FROM deals WHERE id = ?', Number(req.params.id));
  if (!d) throw notFound('הדיל לא נמצא');
  archiveDeal(d.id, 'removed_by_admin');
  audit(req, 'deal.remove', 'deal', d.id, { title: d.title, reason: req.body?.reason || '' });
  res.json({ ok: true });
});

router.post('/deals/:id/feature', (req, res) => {
  const d = one('SELECT id, featured FROM deals WHERE id = ?', Number(req.params.id));
  if (!d) throw notFound('הדיל לא נמצא');
  run('UPDATE deals SET featured = ? WHERE id = ?', d.featured ? 0 : 1, d.id);
  res.json({ featured: !d.featured });
});

router.post('/deals/:id/redesign', async (req, res) => {
  const row = one(`${DEAL_SELECT} WHERE d.id = ?`, Number(req.params.id));
  if (!row) throw notFound('הדיל לא נמצא');
  const ctx = one(`SELECT b.*, c.name AS category_name, c.slug AS category_slug, c.ai_hint, ci.name AS city_name FROM businesses b LEFT JOIN categories c ON c.id = b.category_id LEFT JOIN cities ci ON ci.id = b.city_id WHERE b.id = ?`, row.business_id);
  const { design, source, model, warning } = await designDeal({
    deal: row, business: ctx, category: { name: ctx.category_name, slug: ctx.category_slug, ai_hint: ctx.ai_hint }, city: { name: ctx.city_name }, purpose: 'redesign', seed: Date.now() % 100000,
  });
  run('UPDATE deals SET design = ?, design_source = ?, ai_model = ? WHERE id = ?', JSON.stringify(design), source, model, row.id);
  res.json({ deal: serializeDeal(one(`${DEAL_SELECT} WHERE d.id = ?`, row.id), { includeStats: true }), warning });
});

router.put('/deals/:id/expiry', (req, res) => {
  const d = one('SELECT * FROM deals WHERE id = ?', Number(req.params.id));
  if (!d) throw notFound('הדיל לא נמצא');
  const hours = num(req.body?.hours, { field: 'שעות', required: true, min: getSection('deals').minHours, max: getSection('deals').maxHours });
  const expires = new Date(new Date(d.starts_at).getTime() + hours * 3600_000).toISOString();
  run('UPDATE deals SET duration_hours = ?, expires_at = ? WHERE id = ?', hours, expires, d.id);
  audit(req, 'deal.expiry', 'deal', d.id, { hours });
  res.json({ ok: true, expires_at: expires });
});

// ======================= packages (canvas editor) =======================
function packageInput(body) {
  const content = cleanPackageContent(body);
  return {
    name: str(body.name, { field: 'שם החבילה', required: true, max: 60 }),
    kind: oneOf(body.kind, ['subscription', 'tokens'], { field: 'סוג', fallback: 'subscription' }),
    subtitle: str(body.subtitle, { max: 120 }),
    price: num(body.price, { field: 'מחיר', required: true, min: 0, max: 100000 }),
    compare_price: num(body.compare_price, { field: 'מחיר להשוואה', min: 0, max: 100000 }),
    period: oneOf(body.period, ['month', 'year', 'once'], { field: 'תקופה', fallback: 'month' }),
    tokens: num(body.tokens, { field: 'טוקנים', required: true, min: 0, max: 100000, int: true }),
    priority_listing: bool(body.priority_listing) ? 1 : 0,
    theme: JSON.stringify(content.theme),
    rows: JSON.stringify(content.rows),
    stickers: JSON.stringify(content.stickers),
    cta_text: str(body.cta_text, { max: 40 }) || 'בחירת חבילה',
    is_active: body.is_active === undefined ? 1 : bool(body.is_active) ? 1 : 0,
    show_on_site: body.show_on_site === undefined ? 1 : bool(body.show_on_site) ? 1 : 0,
    show_in_dashboard: body.show_in_dashboard === undefined ? 1 : bool(body.show_in_dashboard) ? 1 : 0,
  };
}

router.get('/packages', (_req, res) => {
  const rows = all(
    `SELECT p.*, (SELECT COUNT(*) FROM businesses b WHERE b.package_id = p.id AND b.status IN ('trial','active','past_due')) AS subscribers FROM packages p ORDER BY p.kind DESC, p.sort_order, p.id`,
  );
  res.json({ packages: rows.map((p) => ({ ...serializePackage(p), subscribers: p.subscribers })) });
});

router.post('/packages', (req, res) => {
  const data = packageInput(req.body || {});
  if (data.kind === 'tokens') data.period = 'once';
  const now = nowIso();
  const maxOrder = one('SELECT COALESCE(MAX(sort_order), 0) AS m FROM packages').m;
  const keys = Object.keys(data);
  const info = run(
    `INSERT INTO packages(${keys.join(', ')}, sort_order, created_at, updated_at) VALUES (${keys.map(() => '?').join(', ')}, ?, ?, ?)`,
    ...keys.map((k) => data[k]), maxOrder + 1, now, now,
  );
  audit(req, 'package.create', 'package', info.lastInsertRowid, { name: data.name });
  res.status(201).json({ package: serializePackage(one('SELECT * FROM packages WHERE id = ?', info.lastInsertRowid)) });
});

router.put('/packages/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!one('SELECT id FROM packages WHERE id = ?', id)) throw notFound('החבילה לא נמצאה');
  const data = packageInput(req.body || {});
  if (data.kind === 'tokens') data.period = 'once';
  const keys = Object.keys(data);
  run(`UPDATE packages SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => data[k]), nowIso(), id);
  audit(req, 'package.update', 'package', id, { name: data.name });
  res.json({ package: serializePackage(one('SELECT * FROM packages WHERE id = ?', id)) });
});

router.post('/packages/reorder', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  tx(() => ids.forEach((id, i) => run('UPDATE packages SET sort_order = ? WHERE id = ?', i + 1, id)))();
  res.json({ ok: true });
});

router.post('/packages/:id/duplicate', (req, res) => {
  const p = one('SELECT * FROM packages WHERE id = ?', Number(req.params.id));
  if (!p) throw notFound('החבילה לא נמצאה');
  const now = nowIso();
  const info = run(
    `INSERT INTO packages(name, kind, subtitle, price, compare_price, period, tokens, priority_listing, theme, rows, stickers, cta_text, is_active, show_on_site, show_in_dashboard, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    `${p.name} (עותק)`, p.kind, p.subtitle, p.price, p.compare_price, p.period, p.tokens, p.priority_listing, p.theme, p.rows, p.stickers, p.cta_text, 0, p.show_on_site,
    p.show_in_dashboard, p.sort_order + 1, now, now,
  );
  res.status(201).json({ package: serializePackage(one('SELECT * FROM packages WHERE id = ?', info.lastInsertRowid)) });
});

router.delete('/packages/:id', (req, res) => {
  const id = Number(req.params.id);
  const inUse = one(`SELECT COUNT(*) AS n FROM businesses WHERE package_id = ?`, id).n;
  if (inUse) throw bad(`לא ניתן למחוק — ${inUse} עסקים משויכים לחבילה. ניתן להשבית אותה במקום.`);
  run('DELETE FROM packages WHERE id = ?', id);
  audit(req, 'package.delete', 'package', id);
  res.json({ ok: true });
});

// ======================= categories & cities =======================
function lookupRoutes(table, label, extra) {
  router.get(`/${table}`, (_req, res) => {
    const countCol = table === 'categories' ? 'category_id' : 'city_id';
    res.json({
      items: all(
        `SELECT t.*, (SELECT COUNT(*) FROM businesses b WHERE b.${countCol} = t.id) AS businesses,
                (SELECT COUNT(*) FROM deals d JOIN businesses b ON b.id = d.business_id WHERE b.${countCol} = t.id) AS live_deals
         FROM ${table} t ORDER BY t.sort_order, t.name`,
      ),
    });
  });
  router.post(`/${table}`, (req, res) => {
    const name = str(req.body?.name, { field: 'שם', required: true, max: 60 });
    let slug = slugify(req.body?.slug || name);
    if (one(`SELECT id FROM ${table} WHERE slug = ?`, slug)) slug = `${slug}-${randomId(2)}`;
    const fields = extra(req.body || {});
    const keys = Object.keys(fields);
    const order = one(`SELECT COALESCE(MAX(sort_order),0) AS m FROM ${table}`).m + 1;
    const info = run(
      `INSERT INTO ${table}(name, slug, ${keys.map((k) => `${k}, `).join('')}sort_order, is_active, created_at) VALUES (?, ?, ${keys.map(() => '?, ').join('')}?, ?, ?)`,
      name, slug, ...keys.map((k) => fields[k]), order, req.body?.is_active === false ? 0 : 1, nowIso(),
    );
    audit(req, `${table}.create`, table, info.lastInsertRowid, { name });
    res.status(201).json({ item: one(`SELECT * FROM ${table} WHERE id = ?`, info.lastInsertRowid) });
  });
  router.put(`/${table}/:id`, (req, res) => {
    const id = Number(req.params.id);
    const row = one(`SELECT * FROM ${table} WHERE id = ?`, id);
    if (!row) throw notFound(`${label} לא נמצא/ה`);
    const name = str(req.body?.name, { field: 'שם', required: true, max: 60 });
    const slug = slugify(req.body?.slug || row.slug);
    if (one(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`, slug, id)) throw bad('הכתובת (slug) כבר קיימת');
    const fields = extra(req.body || {});
    const keys = Object.keys(fields);
    run(
      `UPDATE ${table} SET name = ?, slug = ?, ${keys.map((k) => `${k} = ?, `).join('')}is_active = ? WHERE id = ?`,
      name, slug, ...keys.map((k) => fields[k]), req.body?.is_active === false ? 0 : 1, id,
    );
    res.json({ item: one(`SELECT * FROM ${table} WHERE id = ?`, id) });
  });
  router.post(`/${table}/reorder`, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
    tx(() => ids.forEach((id, i) => run(`UPDATE ${table} SET sort_order = ? WHERE id = ?`, i + 1, id)))();
    res.json({ ok: true });
  });
  router.delete(`/${table}/:id`, (req, res) => {
    const id = Number(req.params.id);
    const countCol = table === 'categories' ? 'category_id' : 'city_id';
    const n = one(`SELECT COUNT(*) AS n FROM businesses WHERE ${countCol} = ?`, id).n;
    if (n) throw bad(`לא ניתן למחוק — ${n} עסקים משויכים. ניתן להשבית במקום.`);
    run(`DELETE FROM ${table} WHERE id = ?`, id);
    audit(req, `${table}.delete`, table, id);
    res.json({ ok: true });
  });
}

lookupRoutes('categories', 'קטגוריה', (b) => ({
  icon: str(b.icon, { max: 40 }) || 'Tag',
  color: /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : '#7cc22a',
  ai_hint: str(b.ai_hint, { field: 'הנחיית AI', max: 200 }),
}));
lookupRoutes('cities', 'עיר', (b) => ({ region: str(b.region, { max: 40 }) }));

// ======================= analytics =======================
function rangeOf(q) {
  const to = q.to ? new Date(new Date(startOfDayIL(String(q.to))).getTime() + 86400_000 - 1) : new Date();
  const from = q.from ? new Date(startOfDayIL(String(q.from))) : new Date(Date.now() - 29 * 86400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw bad('טווח תאריכים לא תקין');
  return [from.toISOString(), to.toISOString()];
}

router.get('/analytics', (req, res) => {
  const [from, to] = rangeOf(req.query);
  const report = analyticsReport(from, to);
  const topDeals = all(
    `SELECT h.title, b.name AS business, h.views, h.clicks_phone, h.clicks_waze, h.feedback FROM deal_history h JOIN businesses b ON b.id = h.business_id
     WHERE h.ended_at BETWEEN ? AND ? ORDER BY h.views DESC LIMIT 10`,
    from, to,
  );
  res.json({ from, to, ...report, topDeals });
});

const DATASETS = {
  events: { title: 'כניסות ואירועים', rows: (f, t) => eventsExport(f, t) },
  daily: { title: 'סיכום יומי', rows: (f, t) => analyticsReport(f, t).daily },
  deals: {
    title: 'דילים שהסתיימו',
    rows: (f, t) =>
      all(
        `SELECT h.id, h.title, b.name AS business, c.name AS category, ci.name AS city, h.original_price, h.discount_percent, h.final_price, h.duration_hours,
                h.started_at, h.ended_at, h.end_reason, h.views, h.clicks_phone, h.clicks_waze, h.clicks_share, h.feedback, h.feedback_customers
         FROM deal_history h JOIN businesses b ON b.id = h.business_id LEFT JOIN categories c ON c.id = h.category_id LEFT JOIN cities ci ON ci.id = h.city_id
         WHERE h.ended_at BETWEEN ? AND ? ORDER BY h.ended_at DESC`,
        f, t,
      ),
  },
  businesses: {
    title: 'עסקים',
    rows: () =>
      all(
        `SELECT b.id, b.name, u.name AS owner, u.email, b.phone, c.name AS category, ci.name AS city, b.status, b.source, p.name AS package, b.token_balance,
                b.trial_ends_at, b.period_end, b.created_at
         FROM businesses b JOIN users u ON u.id = b.user_id LEFT JOIN categories c ON c.id = b.category_id LEFT JOIN cities ci ON ci.id = b.city_id LEFT JOIN packages p ON p.id = b.package_id
         ORDER BY b.id`,
      ),
  },
  payments: {
    title: 'תשלומים',
    rows: (f, t) =>
      all(
        `SELECT p.id, p.invoice_number, p.created_at, b.name AS business, p.kind, p.description, p.amount, p.vat, p.currency, p.status, p.provider, p.provider_ref, p.card_last4
         FROM payments p JOIN businesses b ON b.id = p.business_id WHERE p.created_at BETWEEN ? AND ? ORDER BY p.id DESC`,
        f, t,
      ),
  },
};

router.get('/export', async (req, res) => {
  const dataset = DATASETS[req.query.dataset] ? req.query.dataset : 'events';
  const [from, to] = rangeOf(req.query);
  const rows = DATASETS[dataset].rows(from, to);
  const cols = rows[0] ? Object.keys(rows[0]) : ['empty'];
  const fname = `buldeal-${dataset}-${todayIL()}`;
  audit(req, 'export', dataset, null, { from, to, rows: rows.length });
  if (req.query.format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Buldeal';
    const ws = wb.addWorksheet(DATASETS[dataset].title, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(40, Math.max(12, c.length + 4)) }));
    ws.addRows(rows);
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5C2E' } };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}.xlsx"`);
    await wb.xlsx.write(res);
    return res.end();
  }
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}.csv"`);
  res.send(`\uFEFF${csv}`);
});

// ======================= AI models =======================
router.get('/ai/models', (_req, res) => {
  res.json({
    models: all('SELECT * FROM ai_models ORDER BY is_active DESC, id').map(publicModel),
    catalog: CLAUDE_MODELS,
    efforts: EFFORTS,
    defaultPrompt: DEFAULT_SYSTEM_PROMPT,
    settings: getSection('ai'),
    usage: one(
      `SELECT COUNT(*) AS calls, SUM(success) AS ok, ROUND(AVG(CASE WHEN success = 1 THEN latency_ms END)) AS avg_latency, COALESCE(SUM(input_tokens),0) AS input_tokens,
              COALESCE(SUM(output_tokens),0) AS output_tokens FROM ai_logs WHERE created_at >= ?`,
      addDays(nowIso(), -30),
    ),
  });
});

function modelInput(body, existing) {
  const provider = oneOf(body.provider, ['anthropic', 'builtin'], { field: 'ספק', fallback: existing?.provider || 'anthropic' });
  const out = {
    name: str(body.name, { field: 'שם', required: true, max: 80 }),
    provider,
    model_id: provider === 'builtin' ? 'builtin' : str(body.model_id, { field: 'מזהה מודל', required: true, max: 80 }),
    effort: oneOf(body.effort, EFFORTS, { field: 'רמת מאמץ', fallback: 'low' }),
    max_tokens: num(body.max_tokens, { field: 'max_tokens', min: 2000, max: 64000, int: true }) || 16000,
    system_prompt: str(body.system_prompt, { field: 'הנחיית מערכת', max: 8000, trim: false }),
    creativity: oneOf(body.creativity, ['calm', 'balanced', 'bold'], { fallback: 'balanced' }),
  };
  if (provider === 'anthropic' && !/^[a-z0-9.-]+$/i.test(out.model_id)) throw bad('מזהה מודל לא תקין');
  if (typeof body.api_key === 'string' && body.api_key.trim()) out.api_key = body.api_key.trim();
  if (body.clear_key) out.api_key = '';
  return out;
}

router.post('/ai/models', (req, res) => {
  const data = modelInput(req.body || {});
  const now = nowIso();
  const keys = Object.keys(data);
  const info = run(`INSERT INTO ai_models(${keys.join(', ')}, created_at, updated_at) VALUES (${keys.map(() => '?').join(', ')}, ?, ?)`, ...keys.map((k) => data[k]), now, now);
  audit(req, 'ai.create', 'ai_model', info.lastInsertRowid, { name: data.name, model: data.model_id });
  res.status(201).json({ model: publicModel(one('SELECT * FROM ai_models WHERE id = ?', info.lastInsertRowid)) });
});

router.put('/ai/models/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = one('SELECT * FROM ai_models WHERE id = ?', id);
  if (!existing) throw notFound('המודל לא נמצא');
  const data = modelInput(req.body || {}, existing);
  const keys = Object.keys(data);
  run(`UPDATE ai_models SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => data[k]), nowIso(), id);
  audit(req, 'ai.update', 'ai_model', id, { model: data.model_id, keyChanged: 'api_key' in data });
  res.json({ model: publicModel(one('SELECT * FROM ai_models WHERE id = ?', id)) });
});

router.post('/ai/models/:id/activate', (req, res) => {
  const id = Number(req.params.id);
  if (!one('SELECT id FROM ai_models WHERE id = ?', id)) throw notFound('המודל לא נמצא');
  tx(() => {
    run('UPDATE ai_models SET is_active = 0');
    run('UPDATE ai_models SET is_active = 1 WHERE id = ?', id);
  })();
  audit(req, 'ai.activate', 'ai_model', id);
  res.json({ ok: true });
});

router.post('/ai/models/:id/test', async (req, res) => {
  const m = one('SELECT * FROM ai_models WHERE id = ?', Number(req.params.id));
  if (!m) throw notFound('המודל לא נמצא');
  res.json(await testModel(m));
});

router.delete('/ai/models/:id', (req, res) => {
  const m = one('SELECT * FROM ai_models WHERE id = ?', Number(req.params.id));
  if (!m) throw notFound('המודל לא נמצא');
  if (m.is_active) throw bad('לא ניתן למחוק את המודל הפעיל');
  run('DELETE FROM ai_models WHERE id = ?', m.id);
  audit(req, 'ai.delete', 'ai_model', m.id);
  res.json({ ok: true });
});

router.get('/ai/logs', (req, res) => {
  const { page, size, offset } = pageParams(req.query, 30);
  const items = all(
    `SELECT l.*, b.name AS business FROM ai_logs l LEFT JOIN businesses b ON b.id = l.business_id ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    size, offset,
  );
  res.json({ items, total: one('SELECT COUNT(*) AS n FROM ai_logs').n, page, size });
});

/** Preview a design for an arbitrary deal using the active model (admin playground). */
router.post('/ai/preview', async (req, res) => {
  const b = req.body || {};
  const category = b.categoryId ? one('SELECT name, slug, ai_hint FROM categories WHERE id = ?', Number(b.categoryId)) : null;
  const original = num(b.original_price, { field: 'מחיר', required: true, min: 1, max: 1_000_000 });
  const discount = num(b.discount_percent, { field: 'הנחה', required: true, min: 1, max: 99 });
  const deal = {
    id: null,
    title: str(b.title, { field: 'כותרת', required: true, max: 80 }),
    description: str(b.description, { max: 400 }),
    original_price: original,
    discount_percent: discount,
    final_price: Math.round(original * (1 - discount / 100) * 100) / 100,
    duration_hours: num(b.duration_hours, { min: 1, max: 48 }) || 12,
  };
  const result = await designDeal({ deal, business: { id: null, name: str(b.businessName, { max: 80 }) || 'עסק לדוגמה' }, category, city: { name: str(b.city, { max: 40 }) }, purpose: 'preview', seed: Date.now() % 100000 });
  res.json({ ...result, deal });
});

// ======================= payments & tokens =======================
router.get('/payments', (req, res) => {
  const { page, size, offset } = pageParams(req.query, 30);
  const where = ['1=1'];
  const params = [];
  if (['paid', 'failed', 'refunded'].includes(req.query.status)) {
    where.push('p.status = ?');
    params.push(req.query.status);
  }
  if (['subscription', 'tokens', 'renewal'].includes(req.query.kind)) {
    where.push('p.kind = ?');
    params.push(req.query.kind);
  }
  if (req.query.q) {
    const q = `%${String(req.query.q).slice(0, 60)}%`;
    where.push('(b.name LIKE ? OR p.invoice_number LIKE ? OR p.provider_ref LIKE ?)');
    params.push(q, q, q);
  }
  const base = `FROM payments p JOIN businesses b ON b.id = p.business_id WHERE ${where.join(' AND ')}`;
  const items = all(`SELECT p.*, b.name AS business ${base} ORDER BY p.id DESC LIMIT ? OFFSET ?`, ...params, size, offset);
  const total = one(`SELECT COUNT(*) AS n ${base}`, ...params).n;
  const summary = one(
    `SELECT COALESCE(SUM(CASE WHEN status='paid' THEN amount END),0) AS paid, COALESCE(SUM(CASE WHEN status='refunded' THEN amount END),0) AS refunded,
            SUM(status='failed') AS failed, COALESCE(SUM(CASE WHEN status='paid' THEN vat END),0) AS vat FROM payments`,
  );
  const monthly = all(
    `SELECT substr(created_at, 1, 7) AS month, SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) AS amount, COUNT(*) AS count FROM payments
     WHERE created_at >= ? GROUP BY month ORDER BY month`,
    addDays(nowIso(), -365),
  );
  res.json({ items, total, page, size, summary, monthly });
});

router.post('/payments/:id/refund', (req, res) => {
  refundPayment(Number(req.params.id));
  audit(req, 'payment.refund', 'payment', Number(req.params.id));
  res.json({ ok: true });
});

router.get('/tokens', (req, res) => {
  const { page, size, offset } = pageParams(req.query, 40);
  const items = all(
    `SELECT t.*, b.name AS business FROM token_transactions t JOIN businesses b ON b.id = t.business_id ORDER BY t.id DESC LIMIT ? OFFSET ?`,
    size, offset,
  );
  const summary = one(
    `SELECT COALESCE(SUM(CASE WHEN amount > 0 AND type != 'refund' THEN amount END),0) AS granted, COALESCE(-SUM(CASE WHEN type = 'deal_publish' THEN amount END),0) AS used,
            (SELECT COALESCE(SUM(token_balance),0) FROM businesses) AS outstanding FROM token_transactions`,
  );
  res.json({ items, total: one('SELECT COUNT(*) AS n FROM token_transactions').n, page, size, summary });
});

// ======================= support tickets =======================
router.get('/tickets', (req, res) => {
  const where = ['1=1'];
  const params = [];
  if (['open', 'pending', 'closed'].includes(req.query.status)) {
    where.push('t.status = ?');
    params.push(req.query.status);
  }
  if (['dashboard', 'site'].includes(req.query.source)) {
    where.push('t.source = ?');
    params.push(req.query.source);
  }
  const items = all(
    `SELECT t.*, b.name AS business, b.logo_url,
            (SELECT body FROM ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_message
     FROM tickets t LEFT JOIN businesses b ON b.id = t.business_id WHERE ${where.join(' AND ')} ORDER BY (t.status = 'closed'), t.last_message_at DESC LIMIT 200`,
    ...params,
  );
  res.json({ items });
});

router.get('/tickets/:id', (req, res) => {
  const t = one(`SELECT t.*, b.name AS business, b.logo_url FROM tickets t LEFT JOIN businesses b ON b.id = t.business_id WHERE t.id = ?`, Number(req.params.id));
  if (!t) throw notFound('הפנייה לא נמצאה');
  run('UPDATE tickets SET unread_admin = 0 WHERE id = ?', t.id);
  res.json({ ticket: t, messages: all('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY id', t.id) });
});

router.post('/tickets/:id/messages', async (req, res) => {
  const t = one('SELECT * FROM tickets WHERE id = ?', Number(req.params.id));
  if (!t) throw notFound('הפנייה לא נמצאה');
  const message = str(req.body?.message, { field: 'הודעה', required: true, max: 4000 });
  const now = nowIso();
  run(`INSERT INTO ticket_messages(ticket_id, sender, user_id, body, created_at) VALUES (?,?,?,?,?)`, t.id, 'admin', req.user.id, message, now);
  run(`UPDATE tickets SET status = 'pending', unread_business = unread_business + 1, unread_admin = 0, last_message_at = ? WHERE id = ?`, now, t.id);
  if (t.business_id) notifyBusiness(t.business_id, { type: 'ticket', title: `תשובה חדשה מצוות בולדיל: ${t.subject}`, body: message.slice(0, 200), link: `/dashboard?support=${t.id}` });
  else if (t.email) await sendEmail(t.email, `תשובה לפנייתך: ${t.subject}`, message);
  res.json({ ok: true });
});

router.post('/tickets/:id/status', (req, res) => {
  const status = oneOf(req.body?.status, ['open', 'pending', 'closed'], { field: 'סטטוס' });
  run('UPDATE tickets SET status = ? WHERE id = ?', status, Number(req.params.id));
  res.json({ ok: true });
});

// ======================= broadcast =======================
router.post('/broadcast', (req, res) => {
  const title = str(req.body?.title, { field: 'כותרת', required: true, max: 120 });
  const body = str(req.body?.body, { field: 'תוכן', max: 2000 });
  const audience = oneOf(req.body?.audience, ['all', 'trial', 'active', 'blocked', 'past_due'], { fallback: 'all' });
  const rows = all(`SELECT id FROM businesses ${audience === 'all' ? '' : 'WHERE status = ?'}`, ...(audience === 'all' ? [] : [audience]));
  for (const b of rows) notifyBusiness(b.id, { type: 'admin', title, body, link: '/dashboard/notifications' }, { email: bool(req.body?.email) });
  audit(req, 'broadcast', 'notification', null, { audience, title, count: rows.length });
  res.json({ sent: rows.length });
});

// ======================= settings =======================
router.get('/settings', (_req, res) => res.json({ settings: maskedSettings(), sections: Object.keys(DEFAULT_SETTINGS) }));

router.put('/settings/:section', (req, res) => {
  if (!DEFAULT_SETTINGS[req.params.section]) throw notFound('אזור הגדרות לא קיים');
  const patch = req.body || {};
  if (req.params.section === 'deals') {
    const max = Number(patch.maxHours ?? getSection('deals').maxHours);
    const min = Number(patch.minHours ?? getSection('deals').minHours);
    if (min < 1) throw bad('משך מינימלי לדיל הוא שעה אחת');
    if (max > 48) throw bad('משך מקסימלי לדיל הוא 48 שעות');
    if (min > max) throw bad('המינימום גדול מהמקסימום');
  }
  if (req.params.section === 'trial' && (Number(patch.siteDays) < 0 || Number(patch.adminDays) < 0)) throw bad('ערך לא חוקי');
  updateSection(req.params.section, patch);
  audit(req, 'settings.update', 'settings', null, { section: req.params.section });
  res.json({ settings: maskedSettings() });
});

router.post('/settings/email/test', async (req, res) => {
  await verifyEmailTransport();
  const ok = await sendEmail(req.body?.to || req.user.email, 'בדיקת שליחת מייל — בולדיל', 'אם קיבלת את המייל הזה, הגדרות ה-SMTP תקינות ✅');
  if (!ok) throw bad('החיבור לשרת תקין אך שליחת המייל נכשלה');
  res.json({ ok: true });
});

// ======================= admins & audit =======================
router.get('/admins', (_req, res) => {
  res.json({ items: all(`SELECT id, email, name, phone, is_active, last_login_at, created_at FROM users WHERE role = 'admin' ORDER BY id`) });
});

router.post('/admins', async (req, res) => {
  const mail = email(req.body?.email);
  if (one('SELECT id FROM users WHERE email = ?', mail)) throw bad('האימייל כבר קיים במערכת');
  const pw = password(req.body?.password);
  const info = run(
    `INSERT INTO users(email, password_hash, role, name, phone, created_at) VALUES (?,?,?,?,?,?)`,
    mail, await hashPassword(pw), 'admin', str(req.body?.name, { field: 'שם', required: true, max: 80 }), phone(req.body?.phone), nowIso(),
  );
  audit(req, 'admin.create', 'user', info.lastInsertRowid, { email: mail });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/admins/:id', (req, res) => {
  const id = Number(req.params.id);
  const u = one(`SELECT * FROM users WHERE id = ? AND role = 'admin'`, id);
  if (!u) throw notFound();
  const active = req.body?.is_active === undefined ? u.is_active : bool(req.body.is_active) ? 1 : 0;
  if (!active && id === req.user.id) throw bad('לא ניתן להשבית את המשתמש שלך');
  if (!active && one(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?`, id).n === 0) throw bad('חייב להישאר לפחות מנהל פעיל אחד');
  run('UPDATE users SET name = ?, phone = ?, is_active = ?, token_version = token_version + ? WHERE id = ?', str(req.body?.name, { max: 80 }) || u.name, phone(req.body?.phone) || u.phone, active, active ? 0 : 1, id);
  audit(req, 'admin.update', 'user', id);
  res.json({ ok: true });
});

router.delete('/admins/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw bad('לא ניתן למחוק את המשתמש שלך');
  if (one(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?`, id).n === 0) throw bad('חייב להישאר לפחות מנהל אחד');
  run(`DELETE FROM users WHERE id = ? AND role = 'admin'`, id);
  audit(req, 'admin.delete', 'user', id);
  res.json({ ok: true });
});

router.get('/audit', (req, res) => {
  const { page, size, offset } = pageParams(req.query, 50);
  const items = all(`SELECT a.*, u.email, u.name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT ? OFFSET ?`, size, offset);
  res.json({ items, total: one('SELECT COUNT(*) AS n FROM audit_log').n, page, size });
});

// ======================= system =======================
router.post('/system/run-jobs', async (req, res) => {
  const result = await runJobs({ force: true });
  audit(req, 'system.jobs', 'system', null, result);
  res.json(result);
});

router.get('/system/info', (_req, res) => {
  res.json({
    node: process.version,
    uptime: Math.round(process.uptime()),
    memory: Math.round(process.memoryUsage().rss / 1024 / 1024),
    counts: one(
      `SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM businesses) AS businesses, (SELECT COUNT(*) FROM deals) AS deals,
              (SELECT COUNT(*) FROM deal_history) AS history, (SELECT COUNT(*) FROM analytics_events) AS events, (SELECT COUNT(*) FROM payments) AS payments`,
    ),
  });
});

export { uniqueSlug };
export default router;
