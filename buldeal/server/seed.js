import { one, run, tx } from './db.js';
import { config } from './config.js';
import { hashPassword } from './lib/auth.js';
import { nowIso, slugify } from './lib/utils.js';
import { DEFAULT_SYSTEM_PROMPT } from './services/ai.js';

export const CATEGORIES = [
  ['מסעדות ואוכל', 'food', 'UtensilsCrossed', '#ff6b35', 'צבעים חמים ומעוררי תיאבון'],
  ['בתי קפה ומאפים', 'cafe', 'Coffee', '#8d6e63', 'חמים, קרמי ונעים'],
  ['אופנה', 'fashion', 'Shirt', '#c2185b', 'אלגנטי, מינימליסטי ואופנתי'],
  ['יופי וטיפוח', 'beauty', 'Sparkles', '#e91e63', 'עדין, פסטלי ומפנק'],
  ['ספורט וכושר', 'sport', 'Dumbbell', '#00b0ff', 'אנרגטי, חד ודינמי'],
  ['אלקטרוניקה', 'electronics', 'Smartphone', '#304ffe', 'כהה, ניאון וטכנולוגי'],
  ['בית ועיצוב', 'home', 'Sofa', '#26a69a', 'טבעי, ביתי ונקי'],
  ['בריאות', 'health', 'HeartPulse', '#43a047', 'רענן, נקי ומרגיע'],
  ['רכב', 'car', 'Car', '#546e7a', 'מתכתי, עוצמתי ומהיר'],
  ['בילוי ופנאי', 'fun', 'PartyPopper', '#8e24aa', 'חגיגי, צבעוני ומשוגע'],
  ['ילדים וצעצועים', 'kids', 'Baby', '#ffb300', 'צבעוני, שמח ומשחקי'],
  ['חיות מחמד', 'pets', 'PawPrint', '#ff8f00', 'חמוד, שמשי וחם'],
  ['סופר ומכולת', 'supermarket', 'ShoppingBasket', '#7cb342', 'טרי, ירוק ומשתלם'],
  ['שירותים', 'services', 'Wrench', '#3949ab', 'מקצועי, אמין ונקי'],
];

export const CITIES = [
  ['תל אביב-יפו', 'מרכז'], ['ירושלים', 'ירושלים'], ['חיפה', 'צפון'], ['ראשון לציון', 'מרכז'], ['פתח תקווה', 'מרכז'],
  ['אשדוד', 'דרום'], ['נתניה', 'שרון'], ['באר שבע', 'דרום'], ['חולון', 'מרכז'], ['בני ברק', 'מרכז'],
  ['רמת גן', 'מרכז'], ['רחובות', 'שפלה'], ['בת ים', 'מרכז'], ['אשקלון', 'דרום'], ['הרצליה', 'שרון'],
  ['כפר סבא', 'שרון'], ['חדרה', 'שרון'], ['מודיעין', 'מרכז'], ['רעננה', 'שרון'], ['לוד', 'מרכז'],
  ['רמלה', 'מרכז'], ['נצרת', 'צפון'], ['עפולה', 'צפון'], ['קריית גת', 'דרום'], ['הוד השרון', 'שרון'],
  ['גבעתיים', 'מרכז'], ['קריית אתא', 'צפון'], ['נהריה', 'צפון'], ['אילת', 'דרום'], ['טבריה', 'צפון'],
  ['ראש העין', 'מרכז'], ['יבנה', 'שפלה'], ['קריית שמונה', 'צפון'], ['כרמיאל', 'צפון'], ['עכו', 'צפון'],
  ['אור יהודה', 'מרכז'], ['נס ציונה', 'שפלה'], ['רמת השרון', 'שרון'], ['צפת', 'צפון'], ['דימונה', 'דרום'],
];

const row = (type, text, extra = {}) => ({ id: Math.random().toString(36).slice(2, 10), type, text, ...extra });

export const PACKAGES = [
  {
    name: 'בסיסי', kind: 'subscription', subtitle: 'לעסק שרק מתחיל', price: 99, compare_price: null, period: 'month', tokens: 10, priority_listing: 0,
    theme: { preset: 'mint', bg1: '#ffffff', bg2: '#eef8e4', accent: '#7cc22a', text: '#163b1f' },
    rows: [row('feature', '10 פרסומי דילים בחודש', { icon: 'Ticket', included: true }), row('feature', 'עיצוב כרטיס אוטומטי ב-AI', { icon: 'Wand2', included: true }), row('feature', 'סטטיסטיקות צפיות ולחיצות', { icon: 'BarChart3', included: true }), row('feature', 'קידום בראש הרשימה', { icon: 'Rocket', included: false })],
    stickers: [], cta_text: 'מתחילים', sort_order: 1,
  },
  {
    name: 'עסקי', kind: 'subscription', subtitle: 'הבחירה של רוב העסקים', price: 199, compare_price: 249, period: 'month', tokens: 30, priority_listing: 0,
    theme: { preset: 'lime', bg1: '#1e5c2e', bg2: '#3f8f2a', accent: '#c6f16b', text: '#ffffff' },
    rows: [row('feature', '30 פרסומי דילים בחודש', { icon: 'Ticket', included: true }), row('feature', 'עיצוב כרטיס אוטומטי ב-AI', { icon: 'Wand2', included: true }), row('feature', 'סטטיסטיקות מתקדמות', { icon: 'BarChart3', included: true }), row('feature', 'תמיכה מועדפת', { icon: 'Headphones', included: true }), row('feature', 'קידום בראש הרשימה', { icon: 'Rocket', included: false })],
    stickers: [{ id: 's1', text: 'הכי משתלם', shape: 'ribbon', color: '#ffd23f', textColor: '#3a2600', x: 50, y: 0, rotate: 0 }], cta_text: 'אני רוצה את זה', sort_order: 2,
  },
  {
    name: 'פרימיום', kind: 'subscription', subtitle: 'למקסימום חשיפה', price: 349, compare_price: null, period: 'month', tokens: 70, priority_listing: 1,
    theme: { preset: 'wood', bg1: '#3b2414', bg2: '#8a4b2a', accent: '#ffcf66', text: '#fff7e8' },
    rows: [row('feature', '70 פרסומי דילים בחודש', { icon: 'Ticket', included: true }), row('feature', 'עיצוב כרטיס אוטומטי ב-AI', { icon: 'Wand2', included: true }), row('feature', 'קידום בראש הרשימה + תג "מומלץ"', { icon: 'Rocket', included: true }), row('feature', 'סטטיסטיקות מתקדמות', { icon: 'BarChart3', included: true }), row('feature', 'מנהל לקוח אישי', { icon: 'UserRound', included: true })],
    stickers: [{ id: 's2', text: 'VIP', shape: 'circle', color: '#ff3d71', textColor: '#ffffff', x: 10, y: 4, rotate: -12 }], cta_text: 'לחשיפה מקסימלית', sort_order: 3,
  },
  {
    name: '5 טוקנים', kind: 'tokens', subtitle: 'תוספת קטנה', price: 59, compare_price: null, period: 'once', tokens: 5, priority_listing: 0,
    theme: { preset: 'mint', bg1: '#ffffff', bg2: '#f1f9e8', accent: '#7cc22a', text: '#163b1f' },
    rows: [row('feature', '5 פרסומים נוספים', { icon: 'Ticket', included: true }), row('feature', 'ללא תאריך תפוגה', { icon: 'Infinity', included: true })],
    stickers: [], cta_text: 'רכישה', sort_order: 10,
  },
  {
    name: '15 טוקנים', kind: 'tokens', subtitle: 'הכי פופולרי', price: 149, compare_price: 177, period: 'once', tokens: 15, priority_listing: 0,
    theme: { preset: 'lime', bg1: '#1e5c2e', bg2: '#3f8f2a', accent: '#c6f16b', text: '#ffffff' },
    rows: [row('feature', '15 פרסומים נוספים', { icon: 'Ticket', included: true }), row('feature', 'ללא תאריך תפוגה', { icon: 'Infinity', included: true }), row('feature', 'חיסכון של 16%', { icon: 'BadgePercent', included: true })],
    stickers: [{ id: 's3', text: 'משתלם', shape: 'tag', color: '#ffd23f', textColor: '#3a2600', x: 12, y: 6, rotate: -10 }], cta_text: 'רכישה', sort_order: 11,
  },
  {
    name: '40 טוקנים', kind: 'tokens', subtitle: 'לעסקים עמוסים', price: 349, compare_price: 472, period: 'once', tokens: 40, priority_listing: 0,
    theme: { preset: 'wood', bg1: '#3b2414', bg2: '#8a4b2a', accent: '#ffcf66', text: '#fff7e8' },
    rows: [row('feature', '40 פרסומים נוספים', { icon: 'Ticket', included: true }), row('feature', 'ללא תאריך תפוגה', { icon: 'Infinity', included: true }), row('feature', 'חיסכון של 26%', { icon: 'BadgePercent', included: true })],
    stickers: [], cta_text: 'רכישה', sort_order: 12,
  },
];

export const seedBase = tx(() => {
  const now = nowIso();
  if (!one('SELECT id FROM categories LIMIT 1')) {
    CATEGORIES.forEach(([name, slug, icon, color, hint], i) =>
      run('INSERT INTO categories(name, slug, icon, color, ai_hint, sort_order, created_at) VALUES (?,?,?,?,?,?,?)', name, slug, icon, color, hint, i + 1, now),
    );
  }
  if (!one('SELECT id FROM cities LIMIT 1')) {
    CITIES.forEach(([name, region], i) =>
      run('INSERT INTO cities(name, slug, region, sort_order, created_at) VALUES (?,?,?,?,?)', name, slugify(name), region, i + 1, now),
    );
  }
  if (!one('SELECT id FROM packages LIMIT 1')) {
    for (const p of PACKAGES) {
      run(
        `INSERT INTO packages(name, kind, subtitle, price, compare_price, period, tokens, priority_listing, theme, rows, stickers, cta_text, sort_order, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        p.name, p.kind, p.subtitle, p.price, p.compare_price, p.period, p.tokens, p.priority_listing, JSON.stringify(p.theme), JSON.stringify(p.rows),
        JSON.stringify(p.stickers), p.cta_text, p.sort_order, now, now,
      );
    }
  }
  if (!one('SELECT id FROM ai_models LIMIT 1')) {
    const hasKey = !!config.anthropicKey;
    run(
      `INSERT INTO ai_models(name, provider, model_id, effort, max_tokens, system_prompt, creativity, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      'Claude — מעצב דילים', 'anthropic', 'claude-opus-5-5', 'low', 16000, DEFAULT_SYSTEM_PROMPT, 'balanced', hasKey ? 1 : 0, now, now,
    );
    run(
      `INSERT INTO ai_models(name, provider, model_id, effort, max_tokens, system_prompt, creativity, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      'מעצב מובנה (ללא AI חיצוני)', 'builtin', 'builtin', 'low', 0, '', 'balanced', hasKey ? 0 : 1, now, now,
    );
  }
});

export async function ensureAdmin() {
  if (one(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`)) return false;
  const email = config.adminEmail.trim().toLowerCase();
  const pw = config.adminPassword;
  if (!email || !pw) {
    console.warn('[buldeal] לא נוצר מנהל על: יש להגדיר ADMIN_EMAIL ו-ADMIN_PASSWORD');
    return false;
  }
  const hash = await hashPassword(pw);
  // the initial password is temporary — the admin is asked to choose a new one on first login
  run(
    `INSERT INTO users(email, password_hash, role, name, must_change_password, created_at) VALUES (?,?,?,?,?,?)`,
    email, hash, 'admin', 'מנהל העל', 1, nowIso(),
  );
  console.log(`[buldeal] נוצר מנהל על: ${email} (תתבקש החלפת סיסמה בכניסה הראשונה)`);
  return true;
}
