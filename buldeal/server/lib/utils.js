import crypto from 'node:crypto';
import { config } from '../config.js';

export const nowIso = () => new Date().toISOString();
export const addHours = (date, h) => new Date(new Date(date).getTime() + h * 3600_000).toISOString();
export const addDays = (date, d) => addHours(date, d * 24);
export const addMonths = (date, m) => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + m);
  return d.toISOString();
};

/** YYYY-MM-DD in Israel time */
export function todayIL(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Current Israel UTC offset in hours (2 in winter, 3 in summer). */
export function ilOffsetHours(date = new Date()) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName');
  const m = part?.value.match(/GMT([+-]\d+)/);
  return m ? Number(m[1]) : 2;
}

/** ISO timestamp of local (Israel) midnight for a YYYY-MM-DD date (default: today). */
export function startOfDayIL(day = todayIL()) {
  return new Date(`${day}T00:00:00+0${ilOffsetHours()}:00`).toISOString();
}

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const bad = (msg, code) => new HttpError(400, msg, code);
export const notFound = (msg = 'לא נמצא') => new HttpError(404, msg);
export const forbidden = (msg = 'אין הרשאה') => new HttpError(403, msg);

export function slugify(text) {
  const base = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'biz';
}

export const randomId = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

export function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export const round2 = (n) => Math.round(Number(n) * 100) / 100;

// ---------- tiny input validation helpers ----------
export function str(value, { field = 'שדה', min = 0, max = 500, required = false, trim = true } = {}) {
  if (value == null || value === '') {
    if (required) throw bad(`${field} הוא שדה חובה`);
    return '';
  }
  let s = String(value);
  if (trim) s = s.trim();
  if (required && !s) throw bad(`${field} הוא שדה חובה`);
  if (s.length < min) throw bad(`${field} קצר מדי (מינימום ${min} תווים)`);
  if (s.length > max) throw bad(`${field} ארוך מדי (מקסימום ${max} תווים)`);
  return s;
}

export function num(value, { field = 'ערך', min = -Infinity, max = Infinity, required = false, int = false } = {}) {
  if (value == null || value === '') {
    if (required) throw bad(`${field} הוא שדה חובה`);
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw bad(`${field} חייב להיות מספר`);
  if (int && !Number.isInteger(n)) throw bad(`${field} חייב להיות מספר שלם`);
  if (n < min) throw bad(`${field} חייב להיות לפחות ${min}`);
  if (n > max) throw bad(`${field} יכול להיות לכל היותר ${max}`);
  return n;
}

export const bool = (v) => v === true || v === 1 || v === '1' || v === 'true';

export function email(value, { required = true } = {}) {
  const s = str(value, { field: 'אימייל', max: 160, required }).toLowerCase();
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) throw bad('כתובת אימייל לא תקינה');
  return s;
}

export function phone(value, { required = false, field = 'טלפון' } = {}) {
  const s = str(value, { field, max: 30, required });
  if (s && !/^[+\d][\d\s-]{6,20}$/.test(s)) throw bad(`${field} לא תקין`);
  return s;
}

export function url(value, { field = 'קישור' } = {}) {
  const s = str(value, { field, max: 600 });
  if (!s) return '';
  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    return u.toString();
  } catch {
    throw bad(`${field} אינו קישור תקין`);
  }
}

export function oneOf(value, list, { field = 'ערך', fallback } = {}) {
  if (value == null || value === '') {
    if (fallback !== undefined) return fallback;
    throw bad(`${field} הוא שדה חובה`);
  }
  if (!list.includes(value)) throw bad(`${field} לא חוקי`);
  return value;
}

export function password(value) {
  const s = String(value || '');
  if (s.length < 8) throw bad('הסיסמה חייבת להכיל לפחות 8 תווים');
  if (s.length > 128) throw bad('הסיסמה ארוכה מדי');
  if (!/[A-Za-z֐-׿]/.test(s) || !/\d/.test(s)) throw bad('הסיסמה חייבת לכלול אותיות ומספרים');
  return s;
}

export function wazeLink({ address, lat, lng }) {
  if (lat != null && lng != null && lat !== '' && lng !== '') {
    return `https://waze.com/ul?ll=${encodeURIComponent(`${lat},${lng}`)}&navigate=yes`;
  }
  if (address) return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
  return '';
}

export function pageParams(query, defSize = 20, maxSize = 200) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const size = Math.min(maxSize, Math.max(1, parseInt(query.size, 10) || defSize));
  return { page, size, offset: (page - 1) * size };
}

export function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
