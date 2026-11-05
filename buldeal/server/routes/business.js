import { Router } from 'express';
import { all, one, run, tx } from '../db.js';
import { requireRole } from '../lib/auth.js';
import { imageUpload, uploadedUrl } from '../lib/upload.js';
import { addDays, addHours, bad, bool, forbidden, notFound, nowIso, num, oneOf, pageParams, phone, round2, str, url } from '../lib/utils.js';
import { getSection } from '../services/settings.js';
import { businessPayload } from '../services/businessView.js';
import { serializePackage } from '../services/packages.js';
import { DEAL_SELECT, archiveDeal, deleteUpload, serializeDeal } from '../services/deals.js';
import { consumeToken, tokenSummary } from '../services/tokens.js';
import { designDeal } from '../services/ai.js';
import { buyTokens, subscribe, updateCard } from '../services/billing.js';
import { notifyAdmins } from '../services/notify.js';
import { DAY } from '../services/analytics.js';

const router = Router();
router.use(requireRole('business'));

const canPublish = (b) => ['trial', 'active', 'past_due'].includes(b.status);

function assertCanPublish(b) {
  if (!canPublish(b)) {
    throw Object.assign(forbidden(b.status === 'suspended' ? 'החשבון מושעה. פנו לתמיכה.' : 'החשבון חסום. יש לבחור חבילה ולהשלים תשלום כדי לפרסם.'), { code: 'BLOCKED' });
  }
  if (!b.package_id) throw bad('יש לבחור חבילה לפני פרסום הדיל הראשון', 'NEEDS_PACKAGE');
}

const dealContext = (businessId) =>
  one(
    `SELECT b.*, c.name AS category_name, c.slug AS category_slug, c.ai_hint AS category_hint, ci.name AS city_name
     FROM businesses b LEFT JOIN categories c ON c.id = b.category_id LEFT JOIN cities ci ON ci.id = b.city_id WHERE b.id = ?`,
    businessId,
  );

// ---------------- overview ----------------
router.get('/overview', (req, res) => {
  const id = req.business.id;
  const since = addDays(nowIso(), -13);
  const series = all(
    `SELECT ${DAY()} AS day, SUM(type = 'deal_view') AS views, SUM(type = 'deal_phone') AS phone, SUM(type = 'deal_waze') AS waze
     FROM analytics_events WHERE business_id = ? AND created_at >= ? GROUP BY day ORDER BY day`,
    id, since,
  );
  const live = all(`${DEAL_SELECT} WHERE d.business_id = ? ORDER BY d.expires_at`, id).map((r) => serializeDeal(r, { includeStats: true }));
  const totals = one(
    `SELECT COALESCE(SUM(views),0) AS views, COALESCE(SUM(clicks_phone),0) AS phone, COALESCE(SUM(clicks_waze),0) AS waze, COUNT(*) AS deals,
            SUM(feedback = 'yes') AS helped, SUM(feedback IS NOT NULL) AS answered, COALESCE(SUM(feedback_customers),0) AS customers
     FROM deal_history WHERE business_id = ?`,
    id,
  );
  for (const d of live) {
    totals.views += d.views;
    totals.phone += d.clicks_phone;
    totals.waze += d.clicks_waze;
  }
  const pendingFeedback = all(
    `SELECT id, title, ended_at, views, clicks_phone, clicks_waze FROM deal_history WHERE business_id = ? AND feedback IS NULL AND end_reason = 'expired' ORDER BY ended_at DESC LIMIT 5`,
    id,
  );
  const notifications = all(`SELECT * FROM notifications WHERE business_id = ? AND audience = 'business' ORDER BY id DESC LIMIT 6`, id);
  res.json({ business: businessPayload(id), live, totals, series, pendingFeedback, notifications });
});

// ---------------- deals ----------------
router.get('/deals', (req, res) => {
  const rows = all(`${DEAL_SELECT} WHERE d.business_id = ? ORDER BY d.status, d.expires_at`, req.business.id);
  res.json({ deals: rows.map((r) => serializeDeal(r, { includeStats: true })), serverTime: nowIso() });
});

router.get('/history', (req, res) => {
  const { size, offset } = pageParams(req.query, 20);
  const filter = req.query.filter === 'pending' ? `AND feedback IS NULL AND end_reason = 'expired'` : '';
  const rows = all(`SELECT * FROM deal_history WHERE business_id = ? ${filter} ORDER BY ended_at DESC LIMIT ? OFFSET ?`, req.business.id, size, offset);
  const total = one(`SELECT COUNT(*) AS n FROM deal_history WHERE business_id = ? ${filter}`, req.business.id).n;
  res.json({ items: rows, total });
});

router.post('/history/:id/feedback', (req, res) => {
  const h = one('SELECT * FROM deal_history WHERE id = ? AND business_id = ?', Number(req.params.id), req.business.id);
  if (!h) throw notFound();
  const feedback = oneOf(req.body?.helped, ['yes', 'no'], { field: 'תשובה' });
  const customers = feedback === 'yes' ? num(req.body?.customers, { field: 'מספר לקוחות', min: 0, max: 100000, int: true }) : null;
  const note = str(req.body?.note, { field: 'הערה', max: 500 });
  run('UPDATE deal_history SET feedback = ?, feedback_customers = ?, feedback_note = ?, feedback_at = ? WHERE id = ?', feedback, customers, note, nowIso(), h.id);
  run(`UPDATE notifications SET read_at = ? WHERE business_id = ? AND type = 'feedback' AND link LIKE ? AND read_at IS NULL`, nowIso(), req.business.id, `%feedback=${h.id}`);
  res.json({ ok: true });
});

function parseDealInput(body, { partial = false } = {}) {
  const ds = getSection('deals');
  const out = {};
  if (!partial || 'title' in body) out.title = str(body.title, { field: 'כותרת הדיל', required: true, min: 2, max: 80 });
  if (!partial || 'description' in body) out.description = str(body.description, { field: 'תיאור', max: 400 });
  if (!partial) {
    out.original_price = num(body.original_price, { field: 'מחיר מקורי', required: true, min: 1, max: 1_000_000 });
    out.discount_percent = round2(num(body.discount_percent, { field: 'אחוז הנחה', required: true, min: 1, max: ds.maxDiscount }));
    out.final_price = round2(out.original_price * (1 - out.discount_percent / 100));
    out.duration_hours = num(body.duration_hours, { field: 'משך הפרסום', required: true, min: ds.minHours, max: ds.maxHours });
    out.duration_hours = Math.round(out.duration_hours * 2) / 2;
    const image = str(body.image_url, { max: 200 });
    if (image && !/^\/uploads\/[\w.-]+$/.test(image)) throw bad('תמונה לא חוקית');
    if (ds.requireImage && !image) throw bad('יש להעלות תמונה לדיל');
    out.image_url = image;
    if (body.starts_at) {
      const t = new Date(body.starts_at);
      if (Number.isNaN(t.getTime())) throw bad('מועד התחלה לא תקין');
      if (t.getTime() > Date.now() + 7 * 86400_000) throw bad('ניתן לתזמן דיל עד 7 ימים מראש');
      out.starts_at = t.getTime() > Date.now() + 60_000 ? t.toISOString() : nowIso();
    } else out.starts_at = nowIso();
  }
  for (const k of ['show_phone', 'show_address', 'show_waze']) if (!partial || k in body) out[k] = body[k] === undefined ? 1 : bool(body[k]) ? 1 : 0;
  return out;
}

router.post('/deals', async (req, res) => {
  const b = req.business;
  assertCanPublish(b);
  const input = parseDealInput(req.body || {});
  const ds = getSection('deals');
  const liveCount = one('SELECT COUNT(*) AS n FROM deals WHERE business_id = ?', b.id).n;
  if (liveCount >= ds.maxActivePerBusiness) throw bad(`ניתן להחזיק עד ${ds.maxActivePerBusiness} דילים פעילים במקביל`);
  if (tokenSummary(b.id).available < 1) {
    throw bad(b.status === 'trial' ? 'ניצלת את הטוקן היומי. טוקן חדש יתקבל מחר, או שאפשר לרכוש חבילה כבר עכשיו.' : 'אין טוקנים זמינים. ניתן לרכוש טוקנים במסך החבילות.', 'NO_TOKENS');
  }

  // 1) AI designs the card from the deal data + business category
  const ctx = dealContext(b.id);
  const { design, source, model, warning } = await designDeal({
    deal: { ...input, id: null },
    business: ctx,
    category: ctx.category_id ? { name: ctx.category_name, slug: ctx.category_slug, ai_hint: ctx.category_hint } : null,
    city: { name: ctx.city_name },
    seed: Date.now() % 100000,
  });

  // 2) consume a token and publish atomically
  const status = input.starts_at > nowIso() ? 'scheduled' : 'active';
  const dealId = tx(() => {
    const info = run(
      `INSERT INTO deals(business_id, title, description, original_price, discount_percent, final_price, image_url, duration_hours, starts_at, expires_at, status,
         design, design_source, ai_model, show_phone, show_address, show_waze, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      b.id, input.title, input.description, input.original_price, input.discount_percent, input.final_price, input.image_url, input.duration_hours,
      input.starts_at, addHours(input.starts_at, input.duration_hours), status, JSON.stringify(design), source, model, input.show_phone, input.show_address,
      input.show_waze, nowIso(),
    );
    consumeToken(b.id, `פרסום דיל: ${input.title}`, info.lastInsertRowid);
    return info.lastInsertRowid;
  })();

  const row = one(`${DEAL_SELECT} WHERE d.id = ?`, dealId);
  res.status(201).json({ deal: serializeDeal(row, { includeStats: true }), designSource: source, warning, business: businessPayload(b.id) });
});

router.post('/deals/:id/redesign', async (req, res) => {
  const row = one(`${DEAL_SELECT} WHERE d.id = ? AND d.business_id = ?`, Number(req.params.id), req.business.id);
  if (!row) throw notFound('הדיל לא נמצא');
  const max = getSection('deals').freeRedesigns;
  if (row.redesigns >= max) throw bad(`ניצלת את ${max} העיצובים החוזרים לדיל הזה`);
  const ctx = dealContext(req.business.id);
  const { design, source, model, warning } = await designDeal({
    deal: row,
    business: ctx,
    category: ctx.category_id ? { name: ctx.category_name, slug: ctx.category_slug, ai_hint: ctx.category_hint } : null,
    city: { name: ctx.city_name },
    purpose: 'redesign',
    seed: Date.now() % 100000,
  });
  run('UPDATE deals SET design = ?, design_source = ?, ai_model = ?, redesigns = redesigns + 1 WHERE id = ?', JSON.stringify(design), source, model, row.id);
  const updated = one(`${DEAL_SELECT} WHERE d.id = ?`, row.id);
  res.json({ deal: serializeDeal(updated, { includeStats: true }), warning });
});

router.patch('/deals/:id', (req, res) => {
  const d = one('SELECT * FROM deals WHERE id = ? AND business_id = ?', Number(req.params.id), req.business.id);
  if (!d) throw notFound('הדיל לא נמצא');
  const patch = parseDealInput(req.body || {}, { partial: true });
  delete patch.title; // the headline/prices are locked once published
  const keys = Object.keys(patch);
  if (keys.length) run(`UPDATE deals SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => patch[k]), d.id);
  const row = one(`${DEAL_SELECT} WHERE d.id = ?`, d.id);
  res.json({ deal: serializeDeal(row, { includeStats: true }) });
});

router.delete('/deals/:id', (req, res) => {
  const d = one('SELECT id FROM deals WHERE id = ? AND business_id = ?', Number(req.params.id), req.business.id);
  if (!d) throw notFound('הדיל לא נמצא');
  archiveDeal(d.id, 'removed_by_business', { notify: false });
  res.json({ ok: true });
});

router.post('/uploads/image', (req, res, next) => {
  imageUpload(req, res, (err) => {
    if (err) return next(err.status ? err : bad(err.code === 'LIMIT_FILE_SIZE' ? 'הקובץ גדול מדי (עד 4MB)' : err.message));
    if (!req.file) return next(bad('לא נבחר קובץ'));
    res.json({ url: uploadedUrl(req.file) });
  });
});

// ---------------- stats ----------------
router.get('/stats', (req, res) => {
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  const since = addDays(nowIso(), -days);
  const series = all(
    `SELECT ${DAY()} AS day, SUM(type = 'deal_view') AS views, SUM(type = 'deal_phone') AS phone, SUM(type = 'deal_waze') AS waze, SUM(type = 'deal_share') AS share
     FROM analytics_events WHERE business_id = ? AND created_at >= ? GROUP BY day ORDER BY day`,
    req.business.id, since,
  );
  const devices = all(`SELECT device AS label, COUNT(*) AS value FROM analytics_events WHERE business_id = ? AND created_at >= ? GROUP BY device ORDER BY value DESC`, req.business.id, since);
  const deals = all(
    `SELECT id, title, ended_at, views, clicks_phone, clicks_waze, feedback, feedback_customers, discount_percent FROM deal_history WHERE business_id = ? AND ended_at >= ? ORDER BY views DESC LIMIT 20`,
    req.business.id, since,
  );
  const feedback = one(`SELECT SUM(feedback = 'yes') AS yes, SUM(feedback = 'no') AS no, COALESCE(SUM(feedback_customers),0) AS customers FROM deal_history WHERE business_id = ?`, req.business.id);
  res.json({ series, devices, deals, feedback });
});

// ---------------- profile ----------------
router.get('/profile', (req, res) => {
  const owner = one('SELECT name, email, phone FROM users WHERE id = ?', req.user.id);
  res.json({ business: businessPayload(req.business.id), owner });
});

router.put('/profile', (req, res) => {
  const body = req.body || {};
  const data = {
    name: str(body.name, { field: 'שם העסק', required: true, min: 2, max: 80 }),
    description: str(body.description, { field: 'תיאור', max: 600 }),
    phone: phone(body.phone, { required: true }),
    whatsapp: phone(body.whatsapp, { field: 'וואטסאפ' }),
    address: str(body.address, { field: 'כתובת', max: 160 }),
    waze_url: url(body.waze_url, { field: 'קישור Waze' }),
    website: url(body.website, { field: 'אתר' }),
    instagram: str(body.instagram, { field: 'אינסטגרם', max: 120 }),
    lat: num(body.lat, { field: 'קו רוחב', min: 29, max: 34 }),
    lng: num(body.lng, { field: 'קו אורך', min: 34, max: 36 }),
    category_id: num(body.category_id, { field: 'קטגוריה', required: true, int: true }),
    city_id: num(body.city_id, { field: 'עיר', required: true, int: true }),
  };
  if (data.waze_url && !/^https:\/\/(www\.)?(waze\.com|ul\.waze\.com)\//.test(data.waze_url)) throw bad('הקישור חייב להיות קישור Waze (waze.com)');
  if (!one('SELECT id FROM categories WHERE id = ?', data.category_id)) throw bad('קטגוריה לא חוקית');
  if (!one('SELECT id FROM cities WHERE id = ?', data.city_id)) throw bad('עיר לא חוקית');
  const keys = Object.keys(data);
  run(`UPDATE businesses SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, ...keys.map((k) => data[k]), nowIso(), req.business.id);
  if (body.ownerName) run('UPDATE users SET name = ? WHERE id = ?', str(body.ownerName, { field: 'שם', max: 80 }), req.user.id);
  res.json({ business: businessPayload(req.business.id) });
});

router.post('/profile/logo', (req, res, next) => {
  imageUpload(req, res, (err) => {
    if (err) return next(err.status ? err : bad(err.code === 'LIMIT_FILE_SIZE' ? 'הקובץ גדול מדי (עד 4MB)' : err.message));
    if (!req.file) return next(bad('לא נבחר קובץ'));
    const old = req.business.logo_url;
    run('UPDATE businesses SET logo_url = ?, updated_at = ? WHERE id = ?', uploadedUrl(req.file), nowIso(), req.business.id);
    deleteUpload(old);
    res.json({ business: businessPayload(req.business.id) });
  });
});

router.delete('/profile/logo', (req, res) => {
  deleteUpload(req.business.logo_url);
  run(`UPDATE businesses SET logo_url = '', updated_at = ? WHERE id = ?`, nowIso(), req.business.id);
  res.json({ business: businessPayload(req.business.id) });
});

// ---------------- billing & tokens ----------------
router.get('/billing', (req, res) => {
  const packages = all(`SELECT * FROM packages WHERE is_active = 1 AND show_in_dashboard = 1 ORDER BY sort_order, price`).map(serializePackage);
  const payments = all('SELECT * FROM payments WHERE business_id = ? ORDER BY id DESC LIMIT 100', req.business.id);
  res.json({
    business: businessPayload(req.business.id),
    subscriptions: packages.filter((p) => p.kind === 'subscription'),
    tokenPacks: packages.filter((p) => p.kind === 'tokens'),
    payments,
    billing: { provider: getSection('billing').provider, vatPercent: getSection('billing').vatPercent, pricesIncludeVat: getSection('billing').pricesIncludeVat },
  });
});

router.post('/billing/select-package', (req, res) => {
  const packageId = num(req.body?.packageId, { field: 'חבילה', required: true, int: true });
  if (!one(`SELECT id FROM packages WHERE id = ? AND kind = 'subscription' AND is_active = 1`, packageId)) throw bad('החבילה לא נמצאה');
  if (req.business.status === 'active') throw bad('להחלפת חבילה במנוי פעיל יש לבצע תשלום על החבילה החדשה');
  run('UPDATE businesses SET package_id = ?, updated_at = ? WHERE id = ?', packageId, nowIso(), req.business.id);
  res.json({ business: businessPayload(req.business.id) });
});

router.post('/billing/subscribe', async (req, res) => {
  const packageId = num(req.body?.packageId, { field: 'חבילה', required: true, int: true });
  const result = await subscribe(req.business.id, packageId, req.body?.useSavedCard ? null : req.body?.card);
  res.json({ ok: true, ...result, business: businessPayload(req.business.id) });
});

router.post('/billing/tokens', async (req, res) => {
  const packageId = num(req.body?.packageId, { field: 'חבילה', required: true, int: true });
  const result = await buyTokens(req.business.id, packageId, req.body?.useSavedCard ? null : req.body?.card);
  res.json({ ok: true, ...result, business: businessPayload(req.business.id) });
});

router.post('/billing/card', async (req, res) => {
  const card = await updateCard(req.business.id, req.body?.card);
  res.json({ ok: true, card, business: businessPayload(req.business.id) });
});

router.post('/billing/auto-renew', (req, res) => {
  run('UPDATE businesses SET auto_renew = ?, renewal_warning_sent = 0, updated_at = ? WHERE id = ?', bool(req.body?.enabled) ? 1 : 0, nowIso(), req.business.id);
  res.json({ business: businessPayload(req.business.id) });
});

router.get('/billing/invoices/:id', (req, res) => {
  const p = one(`SELECT * FROM payments WHERE id = ? AND business_id = ? AND status IN ('paid','refunded')`, Number(req.params.id), req.business.id);
  if (!p) throw notFound('החשבונית לא נמצאה');
  const owner = one('SELECT name, email FROM users WHERE id = ?', req.user.id);
  res.json({ payment: p, business: { name: req.business.name, address: req.business.address, phone: req.business.phone, owner: owner.name, email: owner.email }, site: getSection('site') });
});

router.get('/tokens', (req, res) => {
  const { size, offset } = pageParams(req.query, 30);
  const items = all('SELECT * FROM token_transactions WHERE business_id = ? ORDER BY id DESC LIMIT ? OFFSET ?', req.business.id, size, offset);
  const total = one('SELECT COUNT(*) AS n FROM token_transactions WHERE business_id = ?', req.business.id).n;
  res.json({ summary: tokenSummary(req.business.id), items, total });
});

// ---------------- notifications ----------------
router.get('/notifications', (req, res) => {
  const items = all(`SELECT * FROM notifications WHERE business_id = ? AND audience = 'business' ORDER BY id DESC LIMIT 100`, req.business.id);
  res.json({ items, unread: items.filter((n) => !n.read_at).length });
});

router.post('/notifications/read', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger).slice(0, 200) : null;
  if (ids?.length) run(`UPDATE notifications SET read_at = ? WHERE business_id = ? AND id IN (${ids.map(() => '?').join(',')}) AND read_at IS NULL`, nowIso(), req.business.id, ...ids);
  else run('UPDATE notifications SET read_at = ? WHERE business_id = ? AND read_at IS NULL', nowIso(), req.business.id);
  res.json({ ok: true });
});

// ---------------- support tickets (floating contact window) ----------------
router.get('/tickets', (req, res) => {
  const items = all(
    `SELECT t.*, (SELECT body FROM ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_message
     FROM tickets t WHERE business_id = ? ORDER BY last_message_at DESC LIMIT 50`,
    req.business.id,
  );
  res.json({ items });
});

router.post('/tickets', (req, res) => {
  const subject = str(req.body?.subject, { field: 'נושא', max: 120 }) || 'פנייה מהממשק';
  const message = str(req.body?.message, { field: 'הודעה', required: true, max: 3000 });
  const now = nowIso();
  const owner = one('SELECT name, email, phone FROM users WHERE id = ?', req.user.id);
  const t = run(
    `INSERT INTO tickets(business_id, name, email, phone, subject, source, status, unread_admin, last_message_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    req.business.id, owner.name, owner.email, owner.phone, subject, 'dashboard', 'open', 1, now, now,
  );
  run(`INSERT INTO ticket_messages(ticket_id, sender, user_id, body, created_at) VALUES (?,?,?,?,?)`, t.lastInsertRowid, 'business', req.user.id, message, now);
  notifyAdmins({ type: 'ticket', title: `פנייה חדשה: ${req.business.name}`, body: `${subject} — ${message.slice(0, 120)}`, link: `/admin/support?ticket=${t.lastInsertRowid}` });
  res.status(201).json({ id: t.lastInsertRowid });
});

router.get('/tickets/:id', (req, res) => {
  const t = one('SELECT * FROM tickets WHERE id = ? AND business_id = ?', Number(req.params.id), req.business.id);
  if (!t) throw notFound('הפנייה לא נמצאה');
  run('UPDATE tickets SET unread_business = 0 WHERE id = ?', t.id);
  const messages = all('SELECT id, sender, body, created_at FROM ticket_messages WHERE ticket_id = ? ORDER BY id', t.id);
  res.json({ ticket: t, messages });
});

router.post('/tickets/:id/messages', (req, res) => {
  const t = one('SELECT * FROM tickets WHERE id = ? AND business_id = ?', Number(req.params.id), req.business.id);
  if (!t) throw notFound('הפנייה לא נמצאה');
  const message = str(req.body?.message, { field: 'הודעה', required: true, max: 3000 });
  const now = nowIso();
  run(`INSERT INTO ticket_messages(ticket_id, sender, user_id, body, created_at) VALUES (?,?,?,?,?)`, t.id, 'business', req.user.id, message, now);
  run(`UPDATE tickets SET status = 'open', unread_admin = unread_admin + 1, last_message_at = ? WHERE id = ?`, now, t.id);
  notifyAdmins({ type: 'ticket', title: `הודעה חדשה בפנייה: ${t.subject}`, body: message.slice(0, 120), link: `/admin/support?ticket=${t.id}` });
  res.json({ ok: true });
});

export default router;
