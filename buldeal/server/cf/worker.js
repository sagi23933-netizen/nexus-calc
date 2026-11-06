/**
 * BulDeal on Cloudflare Workers.
 *
 * - The built React app (dist/) is served by Workers Static Assets (SPA fallback).
 * - /api/* and /uploads/* go to a single Durable Object ("main") that owns the SQLite
 *   database and runs the exact same routes/services as the Node server.
 * - Scheduled jobs (deal expiry, trial reminders/blocking, renewals) run on a DO alarm every minute.
 */
import { DurableObject } from 'cloudflare:workers';
import { attachStorage } from './shims/better-sqlite3.js';
import { createRequest, ResponseBuilder } from './shims/express.js';
import { one, run } from '../db.js';
import { runtime } from '../lib/runtime.js';
import { csrfGuard, loadUser } from '../lib/auth.js';
import { randomId } from '../lib/utils.js';
import { ensureAdmin, seedBase } from '../seed.js';
import { runJobs } from '../services/scheduler.js';
import { ensureFileTables, getFile, removeFile } from './files.js';
import publicRoutes from '../routes/public.js';
import authRoutes from '../routes/auth.js';
import businessRoutes from '../routes/business.js';
import adminRoutes from '../routes/admin.js';

const MOUNTS = [
  ['/api/public', publicRoutes],
  ['/api/auth', authRoutes],
  ['/api/business', businessRoutes],
  ['/api/admin', adminRoutes],
];

const JOB_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 90_000;

function errorResponse(err, res) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: status >= 500 ? 'שגיאת שרת' : err.message || 'שגיאה', code: err.code });
}

export class BulDealApp extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // expose vars/secrets the same way the Node server reads them
    for (const [k, v] of Object.entries(env)) if (typeof v === 'string') process.env[k] = v;
    attachStorage(ctx.storage);
    ensureFileTables();
    runtime.removeUpload = (url) => removeFile(url.split('/').pop());
    const row = one(`SELECT value FROM settings WHERE key = '_jwt_secret'`);
    if (row) runtime.jwtSecret = row.value;
    else {
      runtime.jwtSecret = randomId(48);
      run(`INSERT INTO settings(key, value) VALUES ('_jwt_secret', ?)`, runtime.jwtSecret);
    }
    ctx.blockConcurrencyWhile(async () => {
      seedBase();
      await ensureAdmin();
      if (!(await ctx.storage.getAlarm())) await ctx.storage.setAlarm(Date.now() + 5_000);
    });
  }

  async alarm() {
    try {
      await runJobs();
    } finally {
      await this.ctx.storage.setAlarm(Date.now() + JOB_INTERVAL_MS);
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    runtime.origin = url.origin;
    if (url.pathname.startsWith('/uploads/')) return this.serveUpload(url);
    if (url.pathname === '/api/auth/login') await ensureAdmin(); // secrets added after the first deploy
    return this.handleApi(request, url);
  }

  serveUpload(url) {
    const name = decodeURIComponent(url.pathname.slice('/uploads/'.length));
    if (!/^[\w.-]+$/.test(name)) return new Response('Not found', { status: 404 });
    const file = getFile(name);
    if (!file) return new Response('Not found', { status: 404 });
    return new Response(file.body, {
      headers: {
        'Content-Type': file.mime,
        'Cache-Control': 'public, max-age=604800, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  async handleApi(request, url) {
    const res = new ResponseBuilder();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    let req;
    try {
      req = await createRequest(request, url);
    } catch (err) {
      errorResponse(err, res);
      return res.toResponse();
    }
    const final = (err) => {
      if (res.finished) return;
      if (err) return errorResponse(err, res);
      res.status(404).json({ error: 'נתיב API לא קיים' });
    };
    const chain = [
      loadUser,
      csrfGuard,
      (rq, rs, next) => {
        const mount = MOUNTS.find(([p]) => url.pathname === p || url.pathname.startsWith(`${p}/`));
        if (!mount) return next();
        rq.baseUrl = mount[0];
        rq.path = url.pathname.slice(mount[0].length) || '/';
        mount[1].handle(rq, rs, next);
      },
    ];
    let i = 0;
    const next = (err) => {
      if (res.finished) return;
      if (err) return final(err);
      const h = chain[i++];
      if (!h) return final();
      try {
        const r = h(req, res, next);
        if (r && typeof r.then === 'function') r.catch(final);
      } catch (e) {
        final(e);
      }
    };
    next();
    let timer;
    await Promise.race([
      res.done,
      new Promise((resolve) => {
        timer = setTimeout(() => {
          if (!res.finished) res.status(504).json({ error: 'הבקשה ארכה זמן רב מדי' });
          resolve();
        }, REQUEST_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timer);
    return res.toResponse();
  }
}

const app = (env) => env.APP.get(env.APP.idFromName('main'));

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/uploads/') && request.method === 'GET') {
      const cache = caches.default;
      const hit = await cache.match(request);
      if (hit) return hit;
      const res = await app(env).fetch(request);
      if (res.ok) ctx.waitUntil(cache.put(request, res.clone()));
      return res;
    }
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return app(env).fetch(request);
    return env.ASSETS.fetch(request);
  },
};
