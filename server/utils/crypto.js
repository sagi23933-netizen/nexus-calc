import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';

function getKey() {
  const secret = process.env.NEXUS_ENCRYPTION_KEY || 'dev-only-insecure-key-change-in-production-please-12345';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decrypt({ ciphertext, iv, tag }) {
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}

export function newId(prefix = '') {
  return `${prefix}${crypto.randomBytes(10).toString('hex')}`;
}
