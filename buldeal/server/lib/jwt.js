import crypto from 'node:crypto';

/** Minimal HS256 JWT (sign/verify) — works on Node and on Cloudflare Workers (nodejs_compat). */
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

export function signJwt(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  return `${header}.${body}.${sign(`${header}.${body}`, secret)}`;
}

export function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const [header, body, sig] = parts;
  const expected = sign(`${header}.${body}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('bad signature');
  const head = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
  if (head.alg !== 'HS256') throw new Error('unsupported alg');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('expired');
  return payload;
}
