import { one, run, tx } from '../db.js';
import { addMonths, bad, nowIso, randomId, round2 } from '../lib/utils.js';
import { getSection } from './settings.js';
import { adjustTokens } from './tokens.js';
import { notifyAdmins, notifyBusiness } from './notify.js';

// ---------- card helpers ----------
function luhn(num) {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function brandOf(num) {
  if (/^4/.test(num)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num)) return 'Amex';
  if (/^(36|38|30[0-5])/.test(num)) return 'Diners';
  return 'Isracard';
}

export function validateCard(card) {
  if (!card || typeof card !== 'object') throw bad('יש להזין פרטי כרטיס אשראי');
  const number = String(card.number || '').replace(/[\s-]/g, '');
  if (!/^\d{8,19}$/.test(number) || !(luhn(number) || number.length === 8 || number.length === 9)) throw bad('מספר כרטיס לא תקין');
  const m = String(card.exp || '').match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m) throw bad('תוקף כרטיס לא תקין (MM/YY)');
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) throw bad('חודש תוקף לא תקין');
  const now = new Date();
  if (year < now.getUTCFullYear() || (year === now.getUTCFullYear() && month < now.getUTCMonth() + 1)) throw bad('תוקף הכרטיס פג');
  if (!/^\d{3,4}$/.test(String(card.cvv || ''))) throw bad('CVV לא תקין');
  const holder = String(card.holder || '').trim().slice(0, 80);
  if (!holder) throw bad('יש להזין שם בעל הכרטיס');
  return { number, exp: `${m[1]}/${m[2]}`, holder, last4: number.slice(-4), brand: brandOf(number) };
}

// ---------- payment providers ----------
/**
 * Demo gateway: approves every valid card except numbers ending in 0002 (simulated decline),
 * and returns a reusable token for renewals. Replace with a real Israeli gateway (Tranzila,
 * Cardcom, Meshulam, Pelecard…) by implementing the same two methods.
 */
const providers = {
  demo: {
    async tokenizeAndCharge({ card, amount }) {
      await new Promise((r) => setTimeout(r, 350));
      if (card.number.endsWith('0002')) return { ok: false, reason: 'העסקה נדחתה על ידי חברת האשראי' };
      return { ok: true, ref: `DEMO-${randomId(5).toUpperCase()}`, token: `demo_${randomId(12)}`, amount };
    },
    async chargeToken({ token, amount }) {
      await new Promise((r) => setTimeout(r, 200));
      if (!token?.startsWith('demo_')) return { ok: false, reason: 'אמצעי התשלום השמור אינו תקין' };
      return { ok: true, ref: `DEMO-${randomId(5).toUpperCase()}`, amount };
    },
  },
};

function provider() {
  const name = getSection('billing').provider;
  const p = providers[name];
  if (!p) throw bad(`ספק הסליקה "${name}" אינו מוגדר במערכת`);
  return { name, ...p };
}

function vatOf(amount) {
  const s = getSection('billing');
  const rate = Number(s.vatPercent) / 100;
  return s.pricesIncludeVat ? round2(amount - amount / (1 + rate)) : round2(amount * rate);
}

function totalOf(price) {
  const s = getSection('billing');
  return s.pricesIncludeVat ? round2(price) : round2(price * (1 + Number(s.vatPercent) / 100));
}

function recordPayment({ businessId, packageId, kind, amount, status, providerName, ref = '', last4 = '', description, failure = '', periodStart = null, periodEnd = null }) {
  const info = run(
    `INSERT INTO payments(business_id, package_id, kind, amount, vat, currency, status, provider, provider_ref, card_last4, description, failure_reason, period_start, period_end, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    businessId, packageId, kind, amount, status === 'paid' ? vatOf(amount) : 0, getSection('billing').currency, status, providerName, ref, last4,
    description, failure, periodStart, periodEnd, nowIso(),
  );
  const id = info.lastInsertRowid;
  if (status === 'paid') {
    run('UPDATE payments SET invoice_number = ? WHERE id = ?', `${getSection('billing').invoicePrefix}${String(id).padStart(6, '0')}`, id);
  }
  return id;
}

const periodMonths = (pkg) => (pkg.period === 'year' ? 12 : 1);

const activateSubscription = tx((businessId, pkg, paymentRef, card, paymentId) => {
  const b = one('SELECT * FROM businesses WHERE id = ?', businessId);
  const now = nowIso();
  // Paying during the trial keeps the remaining trial days: the paid period starts when the trial ends.
  const start = b.status === 'trial' && b.trial_ends_at && b.trial_ends_at > now ? b.trial_ends_at : now;
  const end = addMonths(start, periodMonths(pkg));
  run(
    `UPDATE businesses SET status = 'active', package_id = ?, period_start = ?, period_end = ?, auto_renew = 1, past_due_since = NULL,
       renewal_warning_sent = 0, blocked_reason = '', updated_at = ?
       ${card ? ', card_brand = ?, card_last4 = ?, card_exp = ?, card_holder = ?, card_token = ?' : ''}
     WHERE id = ?`,
    ...[pkg.id, start, end, now],
    ...(card ? [card.brand, card.last4, card.exp, card.holder, paymentRef.token] : []),
    businessId,
  );
  run('UPDATE payments SET period_start = ?, period_end = ? WHERE id = ?', start, end, paymentId);
  if (pkg.tokens > 0) adjustTokens(businessId, pkg.tokens, 'package_grant', `חבילת ${pkg.name}`, { refId: paymentId });
  return { start, end };
});

function getPackage(id, kind) {
  const pkg = one('SELECT * FROM packages WHERE id = ? AND is_active = 1', id);
  if (!pkg) throw bad('החבילה לא נמצאה או אינה פעילה');
  if (kind && pkg.kind !== kind) throw bad(kind === 'tokens' ? 'יש לבחור חבילת טוקנים' : 'יש לבחור חבילת מנוי');
  return pkg;
}

/** Pay for a subscription package (from trial, blocked, or changing package). */
export async function subscribe(businessId, packageId, rawCard) {
  const pkg = getPackage(packageId, 'subscription');
  const b = one('SELECT * FROM businesses WHERE id = ?', businessId);
  if (b.status === 'suspended') throw bad('החשבון מושעה. יש לפנות לתמיכה.');
  const amount = totalOf(pkg.price);
  const p = provider();
  let result;
  let card = null;
  if (rawCard) {
    card = validateCard(rawCard);
    result = await p.tokenizeAndCharge({ card, amount });
  } else if (b.card_token) {
    result = await p.chargeToken({ token: b.card_token, amount });
  } else {
    throw bad('יש להזין פרטי כרטיס אשראי');
  }
  const desc = `מנוי ${pkg.name} (${pkg.period === 'year' ? 'שנתי' : 'חודשי'})`;
  if (!result.ok) {
    recordPayment({ businessId, packageId: pkg.id, kind: 'subscription', amount, status: 'failed', providerName: p.name, last4: card?.last4 || b.card_last4, description: desc, failure: result.reason });
    throw bad(result.reason || 'התשלום נכשל');
  }
  const paymentId = recordPayment({ businessId, packageId: pkg.id, kind: 'subscription', amount, status: 'paid', providerName: p.name, ref: result.ref, last4: card?.last4 || b.card_last4, description: desc });
  const period = activateSubscription(businessId, pkg, result, card, paymentId);
  notifyBusiness(businessId, { type: 'billing', title: `התשלום התקבל — חבילת ${pkg.name} פעילה`, body: `חויבת ב-₪${amount}. ${pkg.tokens} טוקנים נוספו לחשבון.`, link: '/dashboard/billing' }, { email: true });
  notifyAdmins({ type: 'billing', title: `תשלום חדש: ${b.name}`, body: `${desc} — ₪${amount}`, link: `/admin/businesses/${businessId}` });
  return { paymentId, ...period };
}

/** One-time token pack purchase. */
export async function buyTokens(businessId, packageId, rawCard) {
  const pkg = getPackage(packageId, 'tokens');
  const b = one('SELECT * FROM businesses WHERE id = ?', businessId);
  if (['blocked', 'suspended'].includes(b.status)) throw bad('יש להסדיר את המנוי לפני רכישת טוקנים');
  const amount = totalOf(pkg.price);
  const p = provider();
  let result;
  let card = null;
  if (rawCard) {
    card = validateCard(rawCard);
    result = await p.tokenizeAndCharge({ card, amount });
  } else if (b.card_token) {
    result = await p.chargeToken({ token: b.card_token, amount });
  } else {
    throw bad('יש להזין פרטי כרטיס אשראי');
  }
  const desc = `חבילת טוקנים: ${pkg.name} (${pkg.tokens} טוקנים)`;
  if (!result.ok) {
    recordPayment({ businessId, packageId: pkg.id, kind: 'tokens', amount, status: 'failed', providerName: p.name, last4: card?.last4 || b.card_last4, description: desc, failure: result.reason });
    throw bad(result.reason || 'התשלום נכשל');
  }
  const paymentId = recordPayment({ businessId, packageId: pkg.id, kind: 'tokens', amount, status: 'paid', providerName: p.name, ref: result.ref, last4: card?.last4 || b.card_last4, description: desc });
  if (card) {
    run('UPDATE businesses SET card_brand = ?, card_last4 = ?, card_exp = ?, card_holder = ?, card_token = ? WHERE id = ?', card.brand, card.last4, card.exp, card.holder, result.token, businessId);
  }
  const balance = adjustTokens(businessId, pkg.tokens, 'purchase', desc, { refId: paymentId });
  notifyBusiness(businessId, { type: 'billing', title: `${pkg.tokens} טוקנים נוספו לחשבון`, body: `חויבת ב-₪${amount}. היתרה החדשה: ${balance} טוקנים.`, link: '/dashboard/billing' });
  return { paymentId, balance };
}

/** Save/replace the card on file (validated with a ₪0 tokenization in a real gateway). */
export async function updateCard(businessId, rawCard) {
  const card = validateCard(rawCard);
  const p = provider();
  const result = await p.tokenizeAndCharge({ card, amount: 0 });
  if (!result.ok) throw bad(result.reason || 'הכרטיס נדחה');
  run('UPDATE businesses SET card_brand = ?, card_last4 = ?, card_exp = ?, card_holder = ?, card_token = ?, updated_at = ? WHERE id = ?', card.brand, card.last4, card.exp, card.holder, result.token, nowIso(), businessId);
  return { brand: card.brand, last4: card.last4, exp: card.exp };
}

/** Renewal charge — run by the scheduler when the paid period ends. */
export async function renewSubscription(businessId) {
  const b = one('SELECT * FROM businesses WHERE id = ?', businessId);
  const pkg = b.package_id ? one('SELECT * FROM packages WHERE id = ?', b.package_id) : null;
  if (!pkg || !b.card_token) return { ok: false, reason: 'אין חבילה או אמצעי תשלום שמור' };
  const amount = totalOf(pkg.price);
  const p = provider();
  const result = await p.chargeToken({ token: b.card_token, amount });
  const desc = `חידוש מנוי ${pkg.name}`;
  if (!result.ok) {
    recordPayment({ businessId, packageId: pkg.id, kind: 'renewal', amount, status: 'failed', providerName: p.name, last4: b.card_last4, description: desc, failure: result.reason });
    return { ok: false, reason: result.reason };
  }
  const start = b.period_end && b.period_end > nowIso() ? b.period_end : nowIso();
  const end = addMonths(start, periodMonths(pkg));
  const paymentId = recordPayment({ businessId, packageId: pkg.id, kind: 'renewal', amount, status: 'paid', providerName: p.name, ref: result.ref, last4: b.card_last4, description: desc, periodStart: start, periodEnd: end });
  run(`UPDATE businesses SET status = 'active', period_start = ?, period_end = ?, past_due_since = NULL, renewal_warning_sent = 0, blocked_reason = '', updated_at = ? WHERE id = ?`, start, end, nowIso(), businessId);
  if (pkg.tokens > 0) adjustTokens(businessId, pkg.tokens, 'package_grant', `חידוש חבילת ${pkg.name}`, { refId: paymentId });
  notifyBusiness(businessId, { type: 'billing', title: 'המנוי חודש בהצלחה', body: `חויבת ב-₪${amount}. ${pkg.tokens} טוקנים נוספו לחשבון.`, link: '/dashboard/billing' }, { email: true });
  return { ok: true, paymentId };
}

export function refundPayment(paymentId) {
  const pay = one('SELECT * FROM payments WHERE id = ?', paymentId);
  if (!pay) throw bad('תשלום לא נמצא');
  if (pay.status !== 'paid') throw bad('ניתן לזכות רק תשלום שבוצע');
  run(`UPDATE payments SET status = 'refunded' WHERE id = ?`, paymentId);
  notifyBusiness(pay.business_id, { type: 'billing', title: 'בוצע זיכוי', body: `זיכוי על סך ₪${pay.amount} עבור: ${pay.description}`, link: '/dashboard/billing' });
  return true;
}

export { totalOf, vatOf };
