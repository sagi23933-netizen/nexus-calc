import { all, run } from '../db.js';
import { parseJson } from '../lib/utils.js';

export const DEFAULT_SETTINGS = {
  site: {
    name: 'בולדיל',
    tagline: 'דילים בזק מהעסקים שבעיר שלך',
    heroTitle: 'הדילים הכי חמים בעיר — עכשיו',
    heroSubtitle: 'מבצעים מהירים שעסקים מפרסמים לזמן מוגבל. נכנסים, בוחרים עיר, וחוטפים לפני שנגמר.',
    contactEmail: 'support@buldeal.co.il',
    contactPhone: '03-1234567',
    whatsapp: '',
    footerText: 'בולדיל — כל הדילים המהירים במקום אחד.',
    announcementEnabled: false,
    announcementText: '',
    maintenanceMode: false,
  },
  trial: {
    siteDays: 3,
    adminDays: 30,
    dailyTokens: 1,
    warnHoursBefore: 24,
  },
  deals: {
    maxHours: 48,
    minHours: 1,
    defaultHours: 24,
    freeRedesigns: 2,
    maxActivePerBusiness: 5,
    maxDiscount: 95,
    requireImage: false,
  },
  billing: {
    provider: 'demo',
    currency: 'ILS',
    vatPercent: 18,
    pricesIncludeVat: true,
    invoicePrefix: 'BD-',
    graceDays: 3,
    renewalWarnDays: 3,
    terminalId: '',
    apiUser: '',
    apiKey: '',
  },
  email: {
    enabled: false,
    provider: 'resend',
    apiKey: '',
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: 'בולדיל <no-reply@buldeal.co.il>',
  },
  ai: {
    enabled: true,
    fallbackToBuiltin: true,
    timeoutMs: 45000,
  },
  analytics: {
    enabled: true,
    retentionDays: 365,
  },
};

const SECRET_FIELDS = { email: ['pass', 'apiKey'], billing: ['apiKey'] };

let cache = null;

function load() {
  const rows = all('SELECT key, value FROM settings');
  const stored = Object.fromEntries(rows.map((r) => [r.key, parseJson(r.value, {})]));
  const merged = {};
  for (const [section, defaults] of Object.entries(DEFAULT_SETTINGS)) {
    merged[section] = { ...defaults, ...(stored[section] || {}) };
  }
  cache = merged;
  return merged;
}

export function getSettings() {
  return cache || load();
}

export function getSection(section) {
  return getSettings()[section];
}

/** Update a section; only keys known in defaults are accepted, coerced to the default's type. */
export function updateSection(section, patch) {
  const defaults = DEFAULT_SETTINGS[section];
  if (!defaults) throw new Error('unknown settings section');
  const current = getSettings()[section];
  const next = { ...current };
  for (const [key, def] of Object.entries(defaults)) {
    if (!(key in patch)) continue;
    let v = patch[key];
    if ((SECRET_FIELDS[section] || []).includes(key) && (v === '••••••' || v === undefined)) continue;
    if (typeof def === 'number') {
      v = Number(v);
      if (!Number.isFinite(v)) continue;
    } else if (typeof def === 'boolean') {
      v = v === true || v === 'true' || v === 1 || v === '1';
    } else {
      v = String(v ?? '').slice(0, 2000);
    }
    next[key] = v;
  }
  run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', section, JSON.stringify(next));
  cache = null;
  return getSettings()[section];
}

/** Settings safe to send to the admin UI (secrets masked). */
export function maskedSettings() {
  const s = structuredClone(getSettings());
  for (const [section, fields] of Object.entries(SECRET_FIELDS)) {
    for (const f of fields) if (s[section][f]) s[section][f] = '••••••';
  }
  return s;
}

/** Public subset for the website. */
export function publicSettings() {
  const s = getSettings();
  return {
    site: s.site,
    trial: { siteDays: s.trial.siteDays, dailyTokens: s.trial.dailyTokens },
    deals: { maxHours: s.deals.maxHours, minHours: s.deals.minHours, defaultHours: s.deals.defaultHours, maxDiscount: s.deals.maxDiscount, freeRedesigns: s.deals.freeRedesigns, requireImage: s.deals.requireImage },
    billing: { provider: s.billing.provider, currency: s.billing.currency, vatPercent: s.billing.vatPercent, pricesIncludeVat: s.billing.pricesIncludeVat },
  };
}
