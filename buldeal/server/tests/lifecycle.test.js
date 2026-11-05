// Business-rule tests for the deal / trial / billing lifecycle. Runs against a throwaway database.
// Usage: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'buldeal-test-'));
process.env.SEED_DEMO = '0';
process.env.ADMIN_PASSWORD = 'Test12345';

const { seedBase, ensureAdmin } = await import('../seed.js');
const { one, run } = await import('../db.js');
const { createBusinessAccount } = await import('../routes/auth.js');
const { runJobs } = await import('../services/scheduler.js');
const { consumeToken, tokenSummary } = await import('../services/tokens.js');
const { subscribe } = await import('../services/billing.js');
const { addHours, nowIso } = await import('../lib/utils.js');

test('deal, trial and billing lifecycle', async (t) => {
  seedBase();
  await ensureAdmin();
  const pkg = one(`SELECT * FROM packages WHERE kind='subscription' ORDER BY sort_order LIMIT 1`);
  const { businessId: b } = createBusinessAccount({ businessName: 'בדיקה', ownerName: 'א', email: 't@t.co', phone: '0501234567', categoryId: 1, cityId: 1, packageId: pkg.id }, { source: 'site', trialDays: 3, passwordHash: 'x' });

  // daily token: 1 available, second publish fails
  assert.equal(tokenSummary(b).available, 1);
  consumeToken(b, 'test');
  assert.equal(tokenSummary(b).available, 0);
  assert.throws(() => consumeToken(b, 'test2'), /טוקן/);
  t.diagnostic('✓ trial daily token: 1/day, no accumulation');

  // deal expiry → deleted + archived with feedback prompt
  const now = nowIso();
  run(`INSERT INTO deals(business_id,title,original_price,discount_percent,final_price,duration_hours,starts_at,expires_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`, b, 'דיל', 100, 20, 80, 1, addHours(now, -2), addHours(now, -1), 'active', now);
  await runJobs({ force: true });
  assert.equal(one('SELECT COUNT(*) n FROM deals WHERE business_id=?', b).n, 0);
  assert.equal(one('SELECT COUNT(*) n FROM deal_history WHERE business_id=? AND feedback IS NULL', b).n, 1);
  assert.ok(one(`SELECT id FROM notifications WHERE business_id=? AND type='feedback'`, b));
  t.diagnostic('✓ expired deal deleted, history kept, feedback question sent');

  // trial warning a day before
  run('UPDATE businesses SET trial_ends_at=? WHERE id=?', addHours(nowIso(), 20), b);
  await runJobs({ force: true });
  assert.ok(one(`SELECT id FROM notifications WHERE business_id=? AND type='trial'`, b));
  assert.equal(one('SELECT status FROM businesses WHERE id=?', b).status, 'trial');
  t.diagnostic('✓ day-before trial warning sent');

  // trial ended without payment → blocked, live deals removed
  run(`INSERT INTO deals(business_id,title,original_price,discount_percent,final_price,duration_hours,starts_at,expires_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`, b, 'דיל2', 100, 20, 80, 10, nowIso(), addHours(nowIso(), 10), 'active', nowIso());
  run('UPDATE businesses SET trial_ends_at=? WHERE id=?', addHours(nowIso(), -0.01), b);
  await runJobs({ force: true });
  const blocked = one('SELECT status, blocked_reason FROM businesses WHERE id=?', b);
  assert.deepEqual(blocked, { status: 'blocked', blocked_reason: 'trial_ended' });
  assert.equal(one('SELECT COUNT(*) n FROM deals WHERE business_id=?', b).n, 0);
  t.diagnostic('✓ unpaid trial → blocked immediately, deals taken down');

  // payment unblocks and grants tokens
  await subscribe(b, pkg.id, { number: '4242 4242 4242 4242', exp: '12/30', cvv: '123', holder: 'בדיקה' });
  const after = one('SELECT status, token_balance, period_end FROM businesses WHERE id=?', b);
  assert.equal(after.status, 'active');
  assert.equal(after.token_balance, pkg.tokens);
  t.diagnostic(`✓ payment → active, tokens granted: ${after.token_balance}`);

  // declined card
  await assert.rejects(() => subscribe(b, pkg.id, { number: '4000 0000 0000 0002', exp: '12/30', cvv: '123', holder: 'x' }), /נדחתה/);
  t.diagnostic('✓ declined card recorded as failed');

  // renewal when period ends
  run('UPDATE businesses SET period_end=? WHERE id=?', addHours(nowIso(), -1), b);
  await runJobs({ force: true });
  const ren = one('SELECT status, token_balance FROM businesses WHERE id=?', b);
  assert.equal(ren.status, 'active');
  assert.equal(ren.token_balance, pkg.tokens * 2);
  assert.ok(one(`SELECT id FROM payments WHERE business_id=? AND kind='renewal' AND status='paid'`, b));
  t.diagnostic('✓ auto-renewal charged and tokens re-granted');

  // admin-created default 30 days
  const { businessId: b2 } = createBusinessAccount({ businessName: 'אדמין', ownerName: 'ב', email: 'a2@t.co', phone: '0501234567', categoryId: 1, cityId: 1 }, { source: 'admin', trialDays: 30, passwordHash: 'x' });
  const trial = one('SELECT trial_started_at, trial_ends_at FROM businesses WHERE id=?', b2);
  assert.equal(Math.round((new Date(trial.trial_ends_at) - new Date(trial.trial_started_at)) / 86400000), 30);
  t.diagnostic('✓ admin-created business gets 30-day trial');
});
