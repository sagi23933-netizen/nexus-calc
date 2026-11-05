import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { all, one, run } from '../db.js';
import { bad, email, notFound, nowIso, phone, str } from '../lib/utils.js';
import { publicSettings, getSection } from '../services/settings.js';
import { DEAL_SELECT, serializeDeal } from '../services/deals.js';
import { notifyAdmins } from '../services/notify.js';
import { recordEvent } from '../services/analytics.js';
import { serializePackage } from '../services/packages.js';

const router = Router();

const LIVE = `d.status = 'active' AND d.expires_at > ? AND b.status IN ('trial','active','past_due')`;

router.get('/bootstrap', (_req, res) => {
  const now = nowIso();
  const counts = all(
    `SELECT b.category_id AS cat, b.city_id AS city, COUNT(*) AS n FROM deals d JOIN businesses b ON b.id = d.business_id WHERE ${LIVE} GROUP BY b.category_id, b.city_id`,
    now,
  );
  const byCat = {};
  const byCity = {};
  let total = 0;
  for (const c of counts) {
    byCat[c.cat] = (byCat[c.cat] || 0) + c.n;
    byCity[c.city] = (byCity[c.city] || 0) + c.n;
    total += c.n;
  }
  const categories = all('SELECT id, name, slug, icon, color FROM categories WHERE is_active = 1 ORDER BY sort_order, name').map((c) => ({ ...c, deals: byCat[c.id] || 0 }));
  const cities = all('SELECT id, name, slug, region FROM cities WHERE is_active = 1 ORDER BY sort_order, name').map((c) => ({ ...c, deals: byCity[c.id] || 0 }));
  const businesses = one(`SELECT COUNT(*) AS n FROM businesses WHERE status IN ('trial','active')`).n;
  res.json({ settings: publicSettings(), categories, cities, stats: { liveDeals: total, businesses } });
});

router.get('/deals', (req, res) => {
  const now = nowIso();
  const where = [LIVE];
  const params = [now];
  if (req.query.city) {
    where.push('ci.slug = ?');
    params.push(String(req.query.city));
  }
  if (req.query.category) {
    where.push('c.slug = ?');
    params.push(String(req.query.category));
  }
  if (req.query.q) {
    where.push('(d.title LIKE ? OR d.description LIKE ? OR b.name LIKE ?)');
    const q = `%${String(req.query.q).slice(0, 60)}%`;
    params.push(q, q, q);
  }
  if (req.query.business) {
    where.push('b.slug = ?');
    params.push(String(req.query.business));
  }
  const sorts = {
    hot: 'priority_listing DESC, d.featured DESC, (d.views + d.clicks_phone * 5 + d.clicks_waze * 5) DESC',
    ending: 'd.expires_at ASC',
    discount: 'd.discount_percent DESC',
    new: 'd.starts_at DESC',
    price: 'd.final_price ASC',
  };
  const sort = sorts[req.query.sort] || 'priority_listing DESC, d.featured DESC, d.starts_at DESC';
  const limit = Math.min(120, Math.max(1, Number(req.query.limit) || 60));
  const rows = all(`${DEAL_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${sort} LIMIT ${limit}`, ...params);
  res.json({ deals: rows.map((r) => serializeDeal(r)), serverTime: now });
});

router.get('/deals/:id', (req, res) => {
  const row = one(`${DEAL_SELECT} WHERE d.id = ? AND ${LIVE}`, Number(req.params.id), nowIso());
  if (!row) throw notFound('הדיל הסתיים או לא קיים');
  res.json({ deal: serializeDeal(row), serverTime: nowIso() });
});

const eventLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });

router.post('/deals/:id/event', eventLimiter, (req, res) => {
  const type = String(req.body?.type || '');
  const column = { view: 'views', phone: 'clicks_phone', waze: 'clicks_waze', share: 'clicks_share' }[type];
  if (!column) throw bad('סוג אירוע לא חוקי');
  const deal = one('SELECT d.id, d.business_id, b.category_id, b.city_id FROM deals d JOIN businesses b ON b.id = d.business_id WHERE d.id = ?', Number(req.params.id));
  if (!deal) return res.json({ ok: false });
  run(`UPDATE deals SET ${column} = ${column} + 1 WHERE id = ?`, deal.id);
  recordEvent(req, { type: `deal_${type}`, path: req.body?.path, dealId: deal.id, businessId: deal.business_id, categoryId: deal.category_id, cityId: deal.city_id });
  res.json({ ok: true });
});

router.get('/packages', (req, res) => {
  const kind = req.query.kind === 'tokens' ? 'tokens' : req.query.kind === 'all' ? null : 'subscription';
  const rows = all(
    `SELECT * FROM packages WHERE is_active = 1 AND show_on_site = 1 ${kind ? 'AND kind = ?' : ''} ORDER BY sort_order, price`,
    ...(kind ? [kind] : []),
  );
  res.json({ packages: rows.map(serializePackage) });
});

router.get('/businesses/:slug', (req, res) => {
  const b = one(
    `SELECT b.id, b.name, b.slug, b.logo_url, b.description, b.phone, b.address, b.waze_url, b.lat, b.lng, b.website, b.instagram, b.status,
            c.name AS category_name, c.slug AS category_slug, ci.name AS city_name, ci.slug AS city_slug
     FROM businesses b LEFT JOIN categories c ON c.id = b.category_id LEFT JOIN cities ci ON ci.id = b.city_id WHERE b.slug = ?`,
    String(req.params.slug),
  );
  if (!b || !['trial', 'active', 'past_due'].includes(b.status)) throw notFound('העסק לא נמצא');
  const deals = all(`${DEAL_SELECT} WHERE b.id = ? AND ${LIVE} ORDER BY d.expires_at`, b.id, nowIso()).map((r) => serializeDeal(r));
  delete b.status;
  res.json({ business: b, deals, serverTime: nowIso() });
});

const contactLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: true, legacyHeaders: false });

router.post('/contact', contactLimiter, (req, res) => {
  const name = str(req.body?.name, { field: 'שם', required: true, max: 80 });
  const mail = email(req.body?.email, { required: false });
  const tel = phone(req.body?.phone);
  if (!mail && !tel) throw bad('יש להשאיר אימייל או טלפון לחזרה');
  const subject = str(req.body?.subject, { field: 'נושא', max: 120 }) || 'פנייה מהאתר';
  const message = str(req.body?.message, { field: 'הודעה', required: true, max: 3000 });
  const now = nowIso();
  const t = run(
    `INSERT INTO tickets(business_id, name, email, phone, subject, source, status, unread_admin, last_message_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    null, name, mail, tel, subject, 'site', 'open', 1, now, now,
  );
  run(`INSERT INTO ticket_messages(ticket_id, sender, body, created_at) VALUES (?,?,?,?)`, t.lastInsertRowid, 'guest', message, now);
  notifyAdmins({ type: 'ticket', title: `פנייה חדשה מהאתר: ${subject}`, body: `${name} — ${message.slice(0, 120)}`, link: `/admin/support?ticket=${t.lastInsertRowid}` });
  res.json({ ok: true });
});

const trackLimiter = rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: true, legacyHeaders: false });

router.post('/track', trackLimiter, (req, res) => {
  if (!getSection('analytics').enabled) return res.json({ ok: true });
  const type = ['pageview', 'search', 'filter_city', 'filter_category', 'signup_start'].includes(req.body?.type) ? req.body.type : 'pageview';
  const cityId = req.body?.city ? one('SELECT id FROM cities WHERE slug = ?', String(req.body.city))?.id : null;
  const categoryId = req.body?.category ? one('SELECT id FROM categories WHERE slug = ?', String(req.body.category))?.id : null;
  recordEvent(req, { type, path: req.body?.path, cityId, categoryId, referrer: req.body?.referrer, utm: req.body?.utm });
  res.json({ ok: true });
});

router.get('/health', (_req, res) => res.json({ ok: true, time: nowIso() }));

export default router;
