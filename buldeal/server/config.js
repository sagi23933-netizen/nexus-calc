import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { IS_WORKER, runtime } from './lib/runtime.js';

export const ROOT = IS_WORKER ? '/' : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!IS_WORKER) {
  const envFile = path.join(ROOT, '.env');
  if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);
}

const env = (key, fallback = '') => (typeof process !== 'undefined' && process.env?.[key]) || fallback;

export const DATA_DIR = IS_WORKER ? '/data' : env('DATA_DIR') ? path.resolve(env('DATA_DIR')) : path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!IS_WORKER) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let nodeSecret = '';
function loadSecret() {
  const fromEnv = env('JWT_SECRET');
  if (fromEnv.length >= 16) return fromEnv;
  if (IS_WORKER) return runtime.jwtSecret; // generated once and stored in the Durable Object database
  if (nodeSecret) return nodeSecret;
  const file = path.join(DATA_DIR, '.secret');
  if (fs.existsSync(file)) nodeSecret = fs.readFileSync(file, 'utf8').trim();
  else {
    nodeSecret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(file, nodeSecret, { mode: 0o600 });
  }
  return nodeSecret;
}

/** Values are read lazily so Cloudflare vars/secrets (available per request) are always current. */
export const config = {
  get port() {
    return Number(env('PORT', '3101'));
  },
  get isProd() {
    return IS_WORKER || env('NODE_ENV') === 'production';
  },
  get jwtSecret() {
    return loadSecret();
  },
  get adminEmail() {
    return env('ADMIN_EMAIL', IS_WORKER ? '' : 'admin@buldeal.co.il');
  },
  get adminPassword() {
    return env('ADMIN_PASSWORD', IS_WORKER ? '' : 'Admin123!');
  },
  get anthropicKey() {
    return env('ANTHROPIC_API_KEY');
  },
  get seedDemo() {
    return !IS_WORKER && env('SEED_DEMO') !== '0';
  },
  get publicUrl() {
    return (env('PUBLIC_URL') || runtime.origin || 'http://localhost:5173').replace(/\/$/, '');
  },
  dbFile: path.join(DATA_DIR, 'buldeal.db'),
  timezone: 'Asia/Jerusalem',
};
