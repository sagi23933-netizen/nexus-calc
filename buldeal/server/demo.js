import fs from 'node:fs';
import path from 'node:path';
import { all, one, run, tx } from './db.js';
import { UPLOAD_DIR } from './config.js';
import { hashPassword } from './lib/auth.js';
import { addDays, addHours, nowIso, round2, slugify, todayIL } from './lib/utils.js';
import { builtinDesign } from './services/designer.js';

const DEMO = [
  { name: 'פיצה נפוליטנה', cat: 'food', city: 'תל אביב-יפו', phone: '03-5551234', address: 'דיזנגוף 120, תל אביב', colors: ['#ff7a18', '#c81d25'], deals: [['מגש משפחתי + 2 תוספות + שתייה', 89, 40, 6], ['כל הפסטות ב-1+1', 64, 50, 20]] },
  { name: 'קפה לוטוס', cat: 'cafe', city: 'תל אביב-יפו', phone: '03-5559876', address: 'רוטשילד 40, תל אביב', colors: ['#6f4e37', '#c69c72'], deals: [['קפה + מאפה בוקר', 32, 30, 4]] },
  { name: 'סטודיו נועה', cat: 'beauty', city: 'רמת גן', phone: '052-5551010', address: 'ביאליק 12, רמת גן', colors: ['#f7b2c4', '#c9748f'], deals: [['מניקור ג׳ל + טיפוח ידיים', 160, 35, 30]] },
  { name: 'פאוור ג׳ים', cat: 'sport', city: 'חיפה', phone: '04-8551122', address: 'שדרות מוריה 55, חיפה', colors: ['#0f2027', '#2c5364'], deals: [['כרטיסייה ל-10 אימונים', 450, 45, 36]] },
  { name: 'טק סיטי', cat: 'electronics', city: 'ראשון לציון', phone: '03-9661234', address: 'רוטשילד 90, ראשון לציון', colors: ['#302b63', '#00b4d8'], deals: [['אוזניות אלחוטיות ANC', 399, 30, 12], ['מטען מהיר 65W', 149, 40, 24]] },
  { name: 'בוטיק אלמה', cat: 'fashion', city: 'הרצליה', phone: '09-9557788', address: 'סוקולוב 22, הרצליה', colors: ['#232526', '#a3476b'], deals: [['כל השמלות בקולקציה', 320, 40, 18]] },
  { name: 'בית ונוי', cat: 'home', city: 'כפר סבא', phone: '09-7663344', address: 'ויצמן 150, כפר סבא', colors: ['#134e5e', '#71b280'], deals: [['כריות נוי בעבודת יד', 120, 25, 40]] },
  { name: 'פרש מרקט', cat: 'supermarket', city: 'ירושלים', phone: '02-6554433', address: 'יפו 210, ירושלים', colors: ['#56ab2f', '#a8e063'], deals: [['סל ירקות ופירות 5 ק״ג', 60, 33, 8]] },
  { name: 'גלגלי השרון', cat: 'car', city: 'נתניה', phone: '09-8995566', address: 'האומנות 8, נתניה', colors: ['#232526', '#5b6467'], deals: [['טיפול 15,000 ק״מ + שטיפה', 650, 20, 44]] },
  { name: 'פאנפארק', cat: 'fun', city: 'באר שבע', phone: '08-6227788', address: 'שדרות רגר 30, באר שבע', colors: ['#7f00ff', '#e100ff'], deals: [['כרטיס כניסה משפחתי (4)', 260, 50, 10]] },
  { name: 'צעצועי הפלא', cat: 'kids', city: 'פתח תקווה', phone: '03-9331122', address: 'חיים עוזר 15, פתח תקווה', colors: ['#f7971e', '#ffd200'], deals: [['ערכות לגו נבחרות', 220, 30, 28]] },
  { name: 'כלבלב שמח', cat: 'pets', city: 'חולון', phone: '03-5013344', address: 'סוקולוב 60, חולון', colors: ['#f6d365', '#fda085'], deals: [['תספורת + מקלחת לכלב', 180, 30, 16]] },
  { name: 'מרפאת שלווה', cat: 'health', city: 'מודיעין', phone: '08-9701122', address: 'עמק החולה 2, מודיעין', colors: ['#11998e', '#38ef7d'], deals: [['עיסוי רקמות עמוק 60 דק׳', 280, 30, 22]] },
  { name: 'המנעולן המהיר', cat: 'services', city: 'אשדוד', phone: '08-8552211', address: 'הבנים 5, אשדוד', colors: ['#283c86', '#45a247'], deals: [['החלפת צילינדר + מפתחות', 250, 25, 46]] },
  { name: 'בורגר בר', cat: 'food', city: 'ירושלים', phone: '02-6223344', address: 'בן יהודה 7, ירושלים', colors: ['#f9484a', '#fbd72b'], deals: [['ארוחת המבורגר זוגית', 138, 35, 5]] },
  { name: 'מאפיית השוק', cat: 'cafe', city: 'חיפה', phone: '04-8667788', address: 'החלוץ 33, חיפה', colors: ['#3e2723', '#a1887f'], deals: [['6 בורקסים + 2 קפה', 58, 30, 3]] },
];

function initials(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

function writeLogo(slug, name, [c1, c2]) {
  const file = path.join(UPLOAD_DIR, `demo-${slug}.svg`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="200" height="200" rx="100" fill="url(#g)"/><circle cx="100" cy="100" r="84" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="4"/><text x="100" y="122" font-family="Rubik, Arial, sans-serif" font-size="64" font-weight="800" text-anchor="middle" fill="#fff">${initials(name)}</text></svg>`;
  fs.writeFileSync(file, svg);
  return `/uploads/demo-${slug}.svg`;
}

/** Creates demo businesses (once) and fresh active deals, analytics and history for a lively demo. */
export async function seedDemo({ refreshDeals = true } = {}) {
  const now = nowIso();
  const passwordHash = await hashPassword('Demo1234');
  const cats = Object.fromEntries(all('SELECT id, slug FROM categories').map((c) => [c.slug, c.id]));
  const cities = Object.fromEntries(all('SELECT id, name FROM cities').map((c) => [c.name, c.id]));
  const pkgs = all(`SELECT * FROM packages WHERE kind = 'subscription' ORDER BY sort_order`);

  const create = tx(() => {
    DEMO.forEach((d, i) => {
      const email = `demo${i + 1}@buldeal.co.il`;
      let biz = one('SELECT b.* FROM businesses b JOIN users u ON u.id = b.user_id WHERE u.email = ?', email);
      if (!biz) {
        const u = run(`INSERT INTO users(email, password_hash, role, name, phone, created_at) VALUES (?,?,?,?,?,?)`, email, passwordHash, 'business', `בעלים – ${d.name}`, d.phone, addDays(now, -40 + i));
        const slug = `${slugify(d.name)}-${i + 1}`;
        const logo = writeLogo(`logo-${i + 1}`, d.name, d.colors);
        const pkg = pkgs[i % pkgs.length];
        const isTrial = i % 5 === 4;
        const created = addDays(now, -35 + i);
        const b = run(
          `INSERT INTO businesses(user_id, name, slug, category_id, city_id, logo_url, description, phone, address, status, source, trial_days, trial_started_at, trial_ends_at,
             package_id, period_start, period_end, token_balance, daily_tokens, daily_tokens_date, card_brand, card_last4, card_exp, card_holder, card_token, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          u.lastInsertRowid, d.name, slug, cats[d.cat], cities[d.city], logo, `${d.name} — עסק מוביל ב${d.city}.`, d.phone, d.address,
          isTrial ? 'trial' : 'active', i % 3 === 0 ? 'admin' : 'site', isTrial ? 3 : 30, isTrial ? addDays(now, -1) : created, isTrial ? addDays(now, 2) : addDays(created, 30),
          pkg.id, isTrial ? null : addDays(now, -10), isTrial ? null : addDays(now, 20), isTrial ? 0 : pkg.tokens - 3, isTrial ? 1 : 0, todayIL(),
          isTrial ? '' : 'Visa', isTrial ? '' : '4242', isTrial ? '' : '12/29', isTrial ? '' : 'בעל העסק', isTrial ? '' : 'demo_seed', created, now,
        );
        biz = one('SELECT * FROM businesses WHERE id = ?', b.lastInsertRowid);
        if (!isTrial) {
          for (let m = 0; m < 2; m++) {
            const when = addDays(now, -10 - m * 30);
            const pay = run(
              `INSERT INTO payments(business_id, package_id, kind, amount, vat, status, provider, provider_ref, card_last4, description, period_start, period_end, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
              biz.id, pkg.id, m === 0 ? 'renewal' : 'subscription', pkg.price, round2(pkg.price - pkg.price / 1.18), 'paid', 'demo', `DEMO-SEED${i}${m}`, '4242',
              `מנוי ${pkg.name} (חודשי)`, when, addDays(when, 30), when,
            );
            run('UPDATE payments SET invoice_number = ? WHERE id = ?', `BD-${String(pay.lastInsertRowid).padStart(6, '0')}`, pay.lastInsertRowid);
            run(
              `INSERT INTO token_transactions(business_id, amount, balance_after, pool, type, note, ref_id, created_at) VALUES (?,?,?,?,?,?,?,?)`,
              biz.id, pkg.tokens, pkg.tokens, 'balance', 'package_grant', `חבילת ${pkg.name}`, pay.lastInsertRowid, when,
            );
          }
        }
        // past deals with feedback
        for (let h = 0; h < 3; h++) {
          const started = addDays(now, -(h * 6 + 3));
          const [title, price, disc, hours] = d.deals[h % d.deals.length];
          run(
            `INSERT INTO deal_history(deal_id, business_id, title, original_price, discount_percent, final_price, duration_hours, started_at, ended_at, end_reason, category_id, city_id,
               design_source, views, clicks_phone, clicks_waze, clicks_share, feedback, feedback_customers, feedback_at, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            0, biz.id, title, price, disc, round2(price * (1 - disc / 100)), hours, started, addHours(started, hours), 'expired', biz.category_id, biz.city_id, 'builtin',
            120 + ((i * 37 + h * 53) % 400), 8 + ((i + h) % 20), 5 + ((i * 2 + h) % 15), (i + h) % 7,
            h === 0 && i % 4 === 0 ? null : (i + h) % 4 === 0 ? 'no' : 'yes', (i + h) % 4 === 0 ? null : 3 + ((i + h * 3) % 18), addHours(started, hours + 2), addHours(started, hours),
          );
        }
      }
      if (refreshDeals && ['active', 'trial'].includes(biz.status)) {
        run('DELETE FROM deals WHERE business_id = ?', biz.id);
        d.deals.forEach(([title, price, disc, hours], j) => {
          const startedHoursAgo = Math.min(hours - 0.5, 0.5 + ((i * 3 + j * 5) % 7));
          const starts = addHours(now, -startedHoursAgo);
          const deal = { id: i * 10 + j, title, discount_percent: disc };
          const design = builtinDesign({ deal, categorySlug: d.cat, seed: i * 31 + j * 7 + 3 });
          run(
            `INSERT INTO deals(business_id, title, description, original_price, discount_percent, final_price, duration_hours, starts_at, expires_at, status, design, design_source,
               ai_model, featured, views, clicks_phone, clicks_waze, clicks_share, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            biz.id, title, 'בתוקף עד גמר המלאי או עד תום זמן הדיל. בהצגת המסך בקופה.', price, disc, round2(price * (1 - disc / 100)), hours, starts, addHours(starts, hours),
            'active', JSON.stringify(design), 'builtin', 'builtin', 0, 40 + ((i * 17 + j * 29) % 300), (i + j) % 25, (i * 3 + j) % 18, (i + j * 2) % 6, starts,
          );
        });
      }
    });

    // analytics for the last 30 days
    if (!one(`SELECT id FROM analytics_events WHERE visitor_id LIKE 'demo-%' LIMIT 1`)) {
      const devices = ['mobile', 'mobile', 'mobile', 'desktop', 'tablet'];
      const browsers = ['Chrome', 'Safari', 'Chrome', 'Samsung', 'Firefox', 'Edge'];
      const oses = ['Android', 'iOS', 'Android', 'Windows', 'macOS'];
      const refs = ['', '', 'google.com', 'facebook.com', 'instagram.com', 'whatsapp'];
      const paths = ['/', '/', '/', '/?city=tel-aviv', '/pricing', '/register'];
      const cityIds = Object.values(cities).slice(0, 12);
      const catIds = Object.values(cats);
      const insert = `INSERT INTO analytics_events(type, path, visitor_id, session_id, category_id, city_id, referrer, device, browser, os, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
      let seed = 7;
      const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      for (let day = 30; day >= 0; day--) {
        const base = 60 + Math.round(40 * Math.sin(day / 4)) + (30 - day) * 3;
        for (let k = 0; k < base; k++) {
          const at = new Date(Date.now() - day * 86400_000 - rnd() * 86400_000 * (day === 0 ? 0.4 : 1)).toISOString();
          const v = `demo-${Math.floor(rnd() * 900)}`;
          const di = Math.floor(rnd() * devices.length);
          run(insert, 'pageview', paths[Math.floor(rnd() * paths.length)], v, `${v}-${day}`, rnd() < 0.3 ? catIds[Math.floor(rnd() * catIds.length)] : null,
            rnd() < 0.5 ? cityIds[Math.floor(rnd() * cityIds.length)] : null, refs[Math.floor(rnd() * refs.length)], devices[di], browsers[Math.floor(rnd() * browsers.length)], oses[di % oses.length], at);
          if (rnd() < 0.35) run(insert, 'deal_view', '/', v, `${v}-${day}`, null, null, '', devices[di], 'Chrome', oses[di % oses.length], at);
          if (rnd() < 0.08) run(insert, rnd() < 0.5 ? 'deal_phone' : 'deal_waze', '/', v, `${v}-${day}`, null, null, '', devices[di], 'Chrome', oses[di % oses.length], at);
        }
        if (day % 3 === 0) run(insert, 'signup', '/register', `demo-s${day}`, `demo-s${day}`, null, null, '', 'mobile', 'Chrome', 'Android', addDays(now, -day));
      }
    }

    if (!one('SELECT id FROM tickets LIMIT 1')) {
      const b1 = one(`SELECT b.id, b.name FROM businesses b ORDER BY id LIMIT 1`);
      if (b1) {
        const t = run(`INSERT INTO tickets(business_id, name, subject, source, status, unread_admin, last_message_at, created_at) VALUES (?,?,?,?,?,?,?,?)`, b1.id, b1.name, 'איך משנים את התמונה בכרטיס?', 'dashboard', 'open', 1, addHours(now, -3), addHours(now, -3));
        run(`INSERT INTO ticket_messages(ticket_id, sender, body, created_at) VALUES (?,?,?,?)`, t.lastInsertRowid, 'business', 'היי, העליתי דיל ואני רוצה להחליף את התמונה. אפשר?', addHours(now, -3));
      }
      const t2 = run(`INSERT INTO tickets(business_id, name, email, phone, subject, source, status, unread_admin, last_message_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`, null, 'משה כהן', 'moshe@example.com', '050-1234567', 'מעוניין לפרסם את המסעדה שלי', 'site', 'open', 1, addHours(now, -20), addHours(now, -20));
      run(`INSERT INTO ticket_messages(ticket_id, sender, body, created_at) VALUES (?,?,?,?)`, t2.lastInsertRowid, 'guest', 'שלום, יש לי מסעדה בחולון ואשמח לשמוע על החבילות.', addHours(now, -20));
    }
  });
  create();
}
