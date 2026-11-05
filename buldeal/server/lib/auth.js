import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { one } from '../db.js';
import { HttpError } from './utils.js';

export const COOKIE = 'bd_session';
const MAX_AGE_DAYS = 30;

export const hashPassword = (pw) => bcrypt.hash(pw, 11);
export const checkPassword = (pw, hash) => bcrypt.compare(String(pw || ''), hash);

export function setSession(res, user) {
  const token = jwt.sign({ uid: user.id, role: user.role, tv: user.token_version }, config.jwtSecret, { expiresIn: `${MAX_AGE_DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd && config.publicUrl.startsWith('https'),
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
    const payload = jwt.verify(token, config.jwtSecret);
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
    if (role === 'business' && !req.business) return next(new HttpError(403, 'לא נמצא עסק משויך למשתמש'));
    next();
  };
}
