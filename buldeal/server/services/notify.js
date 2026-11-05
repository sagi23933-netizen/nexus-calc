import nodemailer from 'nodemailer';
import { one, run } from '../db.js';
import { nowIso } from '../lib/utils.js';
import { getSection } from './settings.js';
import { config } from '../config.js';

let transport = null;
let transportKey = '';

function getTransport() {
  const s = getSection('email');
  if (!s.enabled || !s.host) return null;
  const key = JSON.stringify([s.host, s.port, s.secure, s.user, s.pass]);
  if (transport && key === transportKey) return transport;
  transport = nodemailer.createTransport({
    host: s.host,
    port: Number(s.port) || 587,
    secure: !!s.secure,
    auth: s.user ? { user: s.user, pass: s.pass } : undefined,
  });
  transportKey = key;
  return transport;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function emailHtml(title, body, link) {
  const site = getSection('site');
  const href = link ? `${config.publicUrl}${link}` : config.publicUrl;
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#f3f7ee;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(20,60,20,.12)">
  <tr><td style="background:linear-gradient(135deg,#1e5c2e,#7cc22a);padding:22px 28px;color:#fff;font-size:22px;font-weight:bold">${escapeHtml(site.name)}</td></tr>
  <tr><td style="padding:28px;color:#1d2a1f;font-size:16px;line-height:1.7">
    <h2 style="margin:0 0 12px;font-size:20px">${escapeHtml(title)}</h2>
    <p style="margin:0 0 20px;white-space:pre-line">${escapeHtml(body)}</p>
    <a href="${escapeHtml(href)}" style="display:inline-block;background:#7cc22a;color:#10300f;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:12px">כניסה למערכת</a>
  </td></tr>
  <tr><td style="padding:16px 28px;background:#f7faf3;color:#6b7c6b;font-size:12px">${escapeHtml(site.footerText)}</td></tr>
  </table></td></tr></table></body></html>`;
}

export async function sendEmail(to, subject, body, link) {
  const t = getTransport();
  if (!t || !to) return false;
  try {
    await t.sendMail({ from: getSection('email').from, to, subject, text: body, html: emailHtml(subject, body, link) });
    return true;
  } catch (err) {
    console.warn('[mail] failed:', err.message);
    return false;
  }
}

export async function verifyEmailTransport() {
  const t = getTransport();
  if (!t) throw new Error('שליחת מיילים כבויה או שחסר שרת SMTP');
  await t.verify();
  return true;
}

/** Create an in-app notification for a business, optionally also emailing the owner. */
export function notifyBusiness(businessId, { type = 'info', title, body = '', link = '' }, { email = false } = {}) {
  const info = run(
    'INSERT INTO notifications(audience, business_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?,?)',
    'business', businessId, type, title, body, link, nowIso(),
  );
  if (email) {
    const owner = one('SELECT u.email FROM businesses b JOIN users u ON u.id = b.user_id WHERE b.id = ?', businessId);
    if (owner) {
      sendEmail(owner.email, title, body, link).then((ok) => {
        if (ok) run('UPDATE notifications SET emailed = 1 WHERE id = ?', info.lastInsertRowid);
      });
    }
  }
  return info.lastInsertRowid;
}

export function notifyAdmins({ type = 'info', title, body = '', link = '' }) {
  run('INSERT INTO notifications(audience, business_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?,?)', 'admin', null, type, title, body, link, nowIso());
}

export function audit(req, action, entity = '', entityId = null, details = '') {
  run(
    'INSERT INTO audit_log(user_id, action, entity, entity_id, details, ip, created_at) VALUES (?,?,?,?,?,?,?)',
    req?.user?.id ?? null, action, entity, entityId, typeof details === 'string' ? details : JSON.stringify(details), req?.ip || '', nowIso(),
  );
}
