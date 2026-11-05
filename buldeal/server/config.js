import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFile);
}

export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function loadSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, '.secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export const config = {
  port: Number(process.env.PORT || 3101),
  isProd: process.env.NODE_ENV === 'production',
  jwtSecret: loadSecret(),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@buldeal.co.il',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin123!',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  seedDemo: process.env.SEED_DEMO !== '0',
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, ''),
  dbFile: path.join(DATA_DIR, 'buldeal.db'),
  timezone: 'Asia/Jerusalem',
};
