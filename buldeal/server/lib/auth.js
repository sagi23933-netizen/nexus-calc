import crypto from 'node:crypto';
import { promisify } from 'node:util';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { one } from '../db.js';
import { HttpError } from './utils.js';
import { signJwt, verifyJwt } from './jwt.js';
import { IS_WORKER } from './runtime.js';

export const COOKIE = 'bd_session';
const MAX_AGE_DAYS = 30;

// PBKDF2-SHA256 (native on Node and on Cloudflare Workers; 100k is the Workers maximum).
// On Cloudflare the default is lower so a login fits the Workers Free plan CPU budget (10 ms);
// override with PASSWORD_ITERATIONS. The iteration count is stored in each hash, so it can change later.
const iterations = () => Math.min(100_000, Number(process.env.PASSWORD_ITERATIONS) || (IS_WORKER ? 40_000 : 100_000));
const pbkdf2 = promisify(crypto.pbkdf2);

export async function hashPassword(pw) {
  const n = iterations();
  const salt = crypto.randomBytes(16);
  const hash = await pbkdf2(String(pw), salt, n, 32, 'sha256');
  return `pbkdf2$${n}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function checkPassword(pw, stored) {
  if (!stored) return false;
  if (stored.startsWith('pbkdf2$')) {
    const [, iter, saltB64, hashB64] = stored.split('$');
    const expected = Buffer.from(hashB64, 'base64');
    const actual = await pbkdf2(String(pw || ''), Buffer.from(saltB64, 'base64'), Number(iter), expected.length, 'sha256');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }
  // legacy bcrypt hashes (early local databases)
  return bcrypt.compare(String(pw || ''), stored);
}

export function setSession(res, user) {
  const token = signJwt({ uid: user.id, role: user.role, tv: user.token_version }, config.jwtSecret, MAX_AGE_DAYS * 86400);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_WORKER || (config.isProd && config.publicUrl.startsWith('https')),
    maxAge: MAX_AGE_DAYS * 86400_000,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

/** Attaches req.user (and req.business for business users) when a valid session cookie exists. */
export function loadUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  try {
    const payload = verifyJwt(token, config.jwtSecret);
    const user = one('SELECT id, email, role, name, phone, is_active, must_change_password, token_version FROM users WHERE id = ?', payload.uid);
    if (user && user.is_active && user.token_version === payload.tv) {
      req.user = user;
      if (user.role === 'business') req.business = one('SELECT * FROM businesses WHERE user_id = ?', user.id);
    }
  } catch {
    /* invalid/expired token — treat as anonymous */
  }
  next();
}

/** Blocks cross-site form posts: mutating API calls must carry our custom header. */
export function csrfGuard(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'buldeal') return next(new HttpError(403, 'בקשה לא מורשית'));
  next();
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'יש להתחבר למערכת'));
    if (req.user.role !== role) return next(new HttpError(403, 'אין הרשאה'));
    // temporary passwords (first admin login, admin-created businesses) must be replaced before anything else
    if (req.user.must_change_password) return next(new HttpError(403, 'יש לבחור סיסמה חדשה לפני הכניסה', 'MUST_CHANGE_PASSWORD'));
    if (role === 'business' && !req.business) return next(new HttpError(403, 'לא נמצא עסק משויך למשתמש'));
    next();
  };
}
