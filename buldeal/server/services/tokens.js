import { one, run, tx } from '../db.js';
import { nowIso, todayIL, bad } from '../lib/utils.js';
import { getSection } from './settings.js';

/**
 * Trial businesses get a daily allowance (default 1 token/day) that does not accumulate.
 * The allowance is refreshed lazily on read and by the scheduler.
 */
export function refreshDailyTokens(businessId) {
  const b = one('SELECT id, status, daily_tokens, daily_tokens_date FROM businesses WHERE id = ?', businessId);
  if (!b) return;
  const today = todayIL();
  if (b.status === 'trial') {
    if (b.daily_tokens_date !== today) {
      const amount = getSection('trial').dailyTokens;
      run('UPDATE businesses SET daily_tokens = ?, daily_tokens_date = ? WHERE id = ?', amount, today, b.id);
      if (amount > 0) {
        run(
          'INSERT INTO token_transactions(business_id, amount, balance_after, pool, type, note, created_at) VALUES (?,?,?,?,?,?,?)',
          b.id, amount, amount, 'daily', 'trial_daily', 'טוקן יומי – תקופת ניסיון', nowIso(),
        );
      }
    }
  } else if (b.daily_tokens > 0) {
    run('UPDATE businesses SET daily_tokens = 0 WHERE id = ?', b.id);
  }
}

export function tokenSummary(businessId) {
  refreshDailyTokens(businessId);
  const b = one('SELECT token_balance, daily_tokens, daily_tokens_date, status FROM businesses WHERE id = ?', businessId);
  const daily = b.status === 'trial' && b.daily_tokens_date === todayIL() ? b.daily_tokens : 0;
  return { balance: b.token_balance, daily, available: b.token_balance + daily };
}

/** Add (or subtract) tokens from the purchasable balance. */
export const adjustTokens = tx((businessId, amount, type, note = '', { refId = null, userId = null } = {}) => {
  const b = one('SELECT token_balance FROM businesses WHERE id = ?', businessId);
  if (!b) throw bad('עסק לא נמצא');
  const next = b.token_balance + amount;
  if (next < 0) throw bad('אין מספיק טוקנים');
  run('UPDATE businesses SET token_balance = ?, updated_at = ? WHERE id = ?', next, nowIso(), businessId);
  run(
    'INSERT INTO token_transactions(business_id, amount, balance_after, pool, type, note, ref_id, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    businessId, amount, next, 'balance', type, note, refId, userId, nowIso(),
  );
  return next;
});

/** Consume one token for a deal publish — daily trial token first, then balance. Must run inside a transaction. */
export function consumeToken(businessId, note, refId = null) {
  refreshDailyTokens(businessId);
  const b = one('SELECT token_balance, daily_tokens, daily_tokens_date, status FROM businesses WHERE id = ?', businessId);
  const today = todayIL();
  if (b.status === 'trial' && b.daily_tokens_date === today && b.daily_tokens > 0) {
    const left = b.daily_tokens - 1;
    run('UPDATE businesses SET daily_tokens = ? WHERE id = ?', left, businessId);
    run(
      'INSERT INTO token_transactions(business_id, amount, balance_after, pool, type, note, ref_id, created_at) VALUES (?,?,?,?,?,?,?,?)',
      businessId, -1, left, 'daily', 'deal_publish', note, refId, nowIso(),
    );
    return 'daily';
  }
  if (b.token_balance > 0) {
    const left = b.token_balance - 1;
    run('UPDATE businesses SET token_balance = ? WHERE id = ?', left, businessId);
    run(
      'INSERT INTO token_transactions(business_id, amount, balance_after, pool, type, note, ref_id, created_at) VALUES (?,?,?,?,?,?,?,?)',
      businessId, -1, left, 'balance', 'deal_publish', note, refId, nowIso(),
    );
    return 'balance';
  }
  if (b.status === 'trial') throw bad('ניצלת את הטוקן היומי של תקופת הניסיון. טוקן חדש יתקבל מחר, או שניתן לרכוש חבילה עכשיו.', 'NO_TOKENS');
  throw bad('אין לך טוקנים זמינים. ניתן לרכוש טוקנים נוספים במסך החבילות.', 'NO_TOKENS');
}

export function refundToken(businessId, pool, note, refId = null) {
  if (pool === 'daily') {
    const b = one('SELECT daily_tokens FROM businesses WHERE id = ?', businessId);
    run('UPDATE businesses SET daily_tokens = ? WHERE id = ?', b.daily_tokens + 1, businessId);
    run(
      'INSERT INTO token_transactions(business_id, amount, balance_after, pool, type, note, ref_id, created_at) VALUES (?,?,?,?,?,?,?,?)',
      businessId, 1, b.daily_tokens + 1, 'daily', 'refund', note, refId, nowIso(),
    );
  } else {
    adjustTokens(businessId, 1, 'refund', note, { refId });
  }
}
