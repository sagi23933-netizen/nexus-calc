import { all, run } from '../db.js';
import { addDays, addHours, nowIso } from '../lib/utils.js';
import { getSection } from './settings.js';
import { archiveDeal, archiveBusinessDeals } from './deals.js';
import { notifyAdmins, notifyBusiness } from './notify.js';
import { refreshDailyTokens } from './tokens.js';
import { renewSubscription } from './billing.js';

const fmtDate = (iso) =>
  new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** Scheduled deals whose start time arrived go live. */
function activateScheduled(now) {
  const rows = all(`SELECT id, business_id, title FROM deals WHERE status = 'scheduled' AND starts_at <= ?`, now);
  for (const d of rows) {
    run(`UPDATE deals SET status = 'active' WHERE id = ?`, d.id);
    notifyBusiness(d.business_id, { type: 'deal', title: `הדיל "${d.title}" עלה לאוויר`, link: '/dashboard/deals' });
  }
  return rows.length;
}

/** Deals past their end time are deleted from the site (max 48h, enforced at creation). */
function expireDeals(now) {
  const rows = all('SELECT id FROM deals WHERE expires_at <= ?', now);
  for (const d of rows) archiveDeal(d.id, 'expired');
  return rows.length;
}

function trialWarnings(now) {
  const { warnHoursBefore } = getSection('trial');
  const rows = all(
    `SELECT id, trial_ends_at FROM businesses WHERE status = 'trial' AND trial_warning_sent = 0 AND trial_ends_at IS NOT NULL AND trial_ends_at <= ?`,
    addHours(now, warnHoursBefore),
  );
  for (const b of rows) {
    notifyBusiness(
      b.id,
      {
        type: 'trial',
        title: 'מחר מסתיימת תקופת הניסיון שלך',
        body: `תקופת הניסיון מסתיימת ב-${fmtDate(b.trial_ends_at)}. כדי להמשיך לפרסם דילים יש לרכוש חבילה — אחרת החשבון ייחסם אוטומטית.`,
        link: '/dashboard/billing',
      },
      { email: true },
    );
    run('UPDATE businesses SET trial_warning_sent = 1 WHERE id = ?', b.id);
  }
  return rows.length;
}

/** Trial over without payment → block immediately. */
function trialExpiry(now) {
  const rows = all(`SELECT id, name FROM businesses WHERE status = 'trial' AND trial_ends_at IS NOT NULL AND trial_ends_at <= ?`, now);
  for (const b of rows) {
    run(`UPDATE businesses SET status = 'blocked', blocked_reason = 'trial_ended', daily_tokens = 0, updated_at = ? WHERE id = ?`, now, b.id);
    archiveBusinessDeals(b.id, 'blocked');
    notifyBusiness(
      b.id,
      { type: 'blocked', title: 'תקופת הניסיון הסתיימה — החשבון נחסם', body: 'כדי לחזור לפרסם דילים יש לבחור חבילה ולהשלים תשלום. כל הנתונים שלך שמורים.', link: '/dashboard/billing' },
      { email: true },
    );
    notifyAdmins({ type: 'trial', title: `תקופת ניסיון הסתיימה ללא תשלום: ${b.name}`, link: `/admin/businesses/${b.id}` });
  }
  return rows.length;
}

function renewalWarnings(now) {
  const { renewalWarnDays } = getSection('billing');
  const rows = all(
    `SELECT id, period_end, auto_renew FROM businesses WHERE status = 'active' AND renewal_warning_sent = 0 AND period_end IS NOT NULL AND period_end <= ?`,
    addDays(now, renewalWarnDays),
  );
  for (const b of rows) {
    notifyBusiness(
      b.id,
      b.auto_renew
        ? { type: 'billing', title: 'המנוי יתחדש בקרוב', body: `המנוי יתחדש אוטומטית ב-${fmtDate(b.period_end)}.`, link: '/dashboard/billing' }
        : { type: 'billing', title: 'המנוי עומד להסתיים', body: `החידוש האוטומטי כבוי והמנוי יסתיים ב-${fmtDate(b.period_end)}. לאחר מכן החשבון ייחסם.`, link: '/dashboard/billing' },
      { email: !b.auto_renew },
    );
    run('UPDATE businesses SET renewal_warning_sent = 1 WHERE id = ?', b.id);
  }
}

async function renewals(now) {
  const rows = all(`SELECT id, name, auto_renew FROM businesses WHERE status = 'active' AND period_end IS NOT NULL AND period_end <= ?`, now);
  for (const b of rows) {
    if (!b.auto_renew) {
      run(`UPDATE businesses SET status = 'blocked', blocked_reason = 'subscription_ended', updated_at = ? WHERE id = ?`, now, b.id);
      archiveBusinessDeals(b.id, 'blocked');
      notifyBusiness(b.id, { type: 'blocked', title: 'המנוי הסתיים', body: 'החשבון הועבר למצב חסום. ניתן לחדש בכל עת ממסך החבילות.', link: '/dashboard/billing' }, { email: true });
      continue;
    }
    const res = await renewSubscription(b.id);
    if (!res.ok) {
      run(`UPDATE businesses SET status = 'past_due', past_due_since = ?, updated_at = ? WHERE id = ?`, now, now, b.id);
      notifyBusiness(
        b.id,
        { type: 'billing', title: 'חידוש המנוי נכשל', body: `${res.reason}. יש לעדכן אמצעי תשלום בימים הקרובים כדי למנוע חסימה.`, link: '/dashboard/billing' },
        { email: true },
      );
      notifyAdmins({ type: 'billing', title: `חידוש מנוי נכשל: ${b.name}`, body: res.reason, link: `/admin/businesses/${b.id}` });
    }
  }
}

async function pastDue(now) {
  const { graceDays } = getSection('billing');
  const rows = all(`SELECT id FROM businesses WHERE status = 'past_due'`);
  for (const b of rows) {
    // retry once a day during the grace period
    const res = await renewSubscription(b.id);
    if (res.ok) continue;
    const row = all('SELECT past_due_since FROM businesses WHERE id = ?', b.id)[0];
    if (row?.past_due_since && addDays(row.past_due_since, graceDays) <= now) {
      run(`UPDATE businesses SET status = 'blocked', blocked_reason = 'payment_failed', updated_at = ? WHERE id = ?`, now, b.id);
      archiveBusinessDeals(b.id, 'blocked');
      notifyBusiness(b.id, { type: 'blocked', title: 'החשבון נחסם עקב אי תשלום', body: 'יש לעדכן אמצעי תשלום ולחדש את המנוי.', link: '/dashboard/billing' }, { email: true });
    }
  }
}

function dailyTokens() {
  for (const b of all(`SELECT id FROM businesses WHERE status = 'trial' OR daily_tokens > 0`)) refreshDailyTokens(b.id);
}

function cleanup(now) {
  const { retentionDays } = getSection('analytics');
  run('DELETE FROM analytics_events WHERE created_at < ?', addDays(now, -Math.max(30, retentionDays)));
  run('DELETE FROM password_resets WHERE expires_at < ?', now);
}

let lastDaily = 0;
let lastPastDue = 0;
let running = false;

export async function runJobs({ force = false } = {}) {
  if (running) return { skipped: true };
  running = true;
  const now = nowIso();
  const result = {};
  try {
    result.activated = activateScheduled(now);
    result.expired = expireDeals(now);
    result.trialWarnings = trialWarnings(now);
    result.trialBlocked = trialExpiry(now);
    renewalWarnings(now);
    await renewals(now);
    dailyTokens();
    if (force || Date.now() - lastPastDue > 24 * 3600_000) {
      lastPastDue = Date.now();
      await pastDue(now);
    }
    if (force || Date.now() - lastDaily > 24 * 3600_000) {
      lastDaily = Date.now();
      cleanup(now);
    }
  } catch (err) {
    console.error('[scheduler]', err);
    result.error = err.message;
  } finally {
    running = false;
  }
  return result;
}

export function startScheduler() {
  runJobs();
  const timer = setInterval(runJobs, 30_000);
  timer.unref();
}
