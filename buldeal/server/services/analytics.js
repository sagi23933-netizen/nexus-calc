import { all, one, run } from '../db.js';
import { ilOffsetHours, nowIso } from '../lib/utils.js';

function parseUA(ua = '') {
  const s = ua.toLowerCase();
  const device = /ipad|tablet/.test(s) ? 'tablet' : /mobi|iphone|android/.test(s) ? 'mobile' : 'desktop';
  const browser = /samsungbrowser/.test(s)
    ? 'Samsung'
    : /edg\//.test(s)
      ? 'Edge'
      : /firefox|fxios/.test(s)
        ? 'Firefox'
        : /chrome|crios/.test(s)
          ? 'Chrome'
          : /safari/.test(s)
            ? 'Safari'
            : 'אחר';
  const os = /android/.test(s) ? 'Android' : /iphone|ipad|ios/.test(s) ? 'iOS' : /windows/.test(s) ? 'Windows' : /mac os/.test(s) ? 'macOS' : /linux/.test(s) ? 'Linux' : 'אחר';
  return { device, browser, os };
}

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview/i;

function refHost(ref) {
  if (!ref) return '';
  try {
    return new URL(ref).hostname.replace(/^www\./, '');
  } catch {
    return String(ref).slice(0, 60);
  }
}

/** Store an analytics event. Visitor/session ids are random client-side ids — no IP or personal data is stored. */
export function recordEvent(req, { type, path = '', dealId = null, businessId = null, categoryId = null, cityId = null, referrer = '', utm = '' }) {
  const ua = req.get('user-agent') || '';
  if (BOT.test(ua)) return;
  const { device, browser, os } = parseUA(ua);
  const visitor = String(req.get('x-visitor-id') || req.body?.visitorId || '').slice(0, 40);
  const session = String(req.get('x-session-id') || req.body?.sessionId || '').slice(0, 40);
  const host = refHost(referrer);
  run(
    `INSERT INTO analytics_events(type, path, visitor_id, session_id, deal_id, business_id, category_id, city_id, referrer, utm_source, device, browser, os, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    type, String(path || '').slice(0, 200), visitor, session, dealId, businessId, categoryId, cityId, host === req.hostname ? '' : host,
    String(utm || '').slice(0, 60), device, browser, os, nowIso(),
  );
}

export const DAY = (col = 'created_at') => `substr(datetime(${col}, '+${ilOffsetHours()} hours'), 1, 10)`;

export function analyticsReport(from, to) {
  const range = [from, to];
  const daily = all(
    `SELECT ${DAY()} AS day,
            SUM(type = 'pageview') AS views,
            COUNT(DISTINCT CASE WHEN type = 'pageview' THEN visitor_id END) AS visitors,
            COUNT(DISTINCT CASE WHEN type = 'pageview' THEN session_id END) AS sessions,
            SUM(type = 'deal_view') AS deal_views,
            SUM(type IN ('deal_phone','deal_waze')) AS deal_clicks,
            SUM(type = 'signup') AS signups
     FROM analytics_events WHERE created_at BETWEEN ? AND ? GROUP BY day ORDER BY day`,
    ...range,
  );
  const totals = one(
    `SELECT SUM(type = 'pageview') AS views,
            COUNT(DISTINCT CASE WHEN type = 'pageview' THEN visitor_id END) AS visitors,
            COUNT(DISTINCT CASE WHEN type = 'pageview' THEN session_id END) AS sessions,
            SUM(type = 'deal_view') AS deal_views,
            SUM(type = 'deal_phone') AS phone_clicks,
            SUM(type = 'deal_waze') AS waze_clicks,
            SUM(type = 'deal_share') AS shares,
            SUM(type = 'signup') AS signups
     FROM analytics_events WHERE created_at BETWEEN ? AND ?`,
    ...range,
  );
  const group = (col, extra = '') =>
    all(
      `SELECT ${col} AS label, COUNT(*) AS value FROM analytics_events WHERE created_at BETWEEN ? AND ? AND type = 'pageview' ${extra} GROUP BY ${col} ORDER BY value DESC LIMIT 10`,
      ...range,
    );
  const devices = group('device');
  const browsers = group('browser');
  const os = group('os');
  const referrers = group(`CASE WHEN referrer = '' THEN 'כניסה ישירה' ELSE referrer END`);
  const pages = group('path');
  const hours = all(
    `SELECT CAST(substr(datetime(created_at, '+${ilOffsetHours()} hours'), 12, 2) AS INTEGER) AS hour, COUNT(*) AS value FROM analytics_events
     WHERE created_at BETWEEN ? AND ? AND type = 'pageview' GROUP BY hour ORDER BY hour`,
    ...range,
  );
  const cities = all(
    `SELECT c.name AS label, COUNT(*) AS value FROM analytics_events e JOIN cities c ON c.id = e.city_id
     WHERE e.created_at BETWEEN ? AND ? GROUP BY c.id ORDER BY value DESC LIMIT 10`,
    ...range,
  );
  const categories = all(
    `SELECT c.name AS label, c.color AS color, COUNT(*) AS value FROM analytics_events e JOIN categories c ON c.id = e.category_id
     WHERE e.created_at BETWEEN ? AND ? GROUP BY c.id ORDER BY value DESC LIMIT 10`,
    ...range,
  );
  const live = one(`SELECT COUNT(DISTINCT visitor_id) AS n FROM analytics_events WHERE created_at >= ?`, new Date(Date.now() - 5 * 60_000).toISOString()).n;
  return { daily, totals, devices, browsers, os, referrers, pages, hours, cities, categories, live };
}

export function eventsExport(from, to) {
  return all(
    `SELECT e.id, e.created_at, e.type, e.path, e.visitor_id, e.session_id, e.device, e.browser, e.os, e.referrer, e.utm_source,
            e.deal_id, b.name AS business, c.name AS category, ci.name AS city
     FROM analytics_events e
     LEFT JOIN businesses b ON b.id = e.business_id
     LEFT JOIN categories c ON c.id = e.category_id
     LEFT JOIN cities ci ON ci.id = e.city_id
     WHERE e.created_at BETWEEN ? AND ? ORDER BY e.created_at DESC LIMIT 200000`,
    from, to,
  );
}
