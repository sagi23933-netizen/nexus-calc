/**
 * Uploaded images on Cloudflare live inside the Durable Object's SQLite database
 * (split into 1 MB chunks because a single row is limited to 2 MB).
 */
import { db, one, all, run, tx } from '../db.js';
import { nowIso } from '../lib/utils.js';

const CHUNK = 1_000_000;

export function ensureFileTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      name TEXT PRIMARY KEY,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS file_chunks (
      name TEXT NOT NULL,
      idx INTEGER NOT NULL,
      data BLOB NOT NULL,
      PRIMARY KEY (name, idx)
    );
  `);
}

const toBuffer = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);

export const saveFile = tx((name, mime, bytes) => {
  run('DELETE FROM file_chunks WHERE name = ?', name);
  run('INSERT OR REPLACE INTO files(name, mime, size, created_at) VALUES (?,?,?,?)', name, mime, bytes.byteLength, nowIso());
  for (let i = 0, idx = 0; i < bytes.byteLength; i += CHUNK, idx++) {
    run('INSERT INTO file_chunks(name, idx, data) VALUES (?,?,?)', name, idx, toBuffer(bytes.subarray(i, i + CHUNK)));
  }
});

export function getFile(name) {
  const meta = one('SELECT mime, size FROM files WHERE name = ?', name);
  if (!meta) return null;
  const body = new Uint8Array(meta.size);
  let offset = 0;
  for (const c of all('SELECT data FROM file_chunks WHERE name = ? ORDER BY idx', name)) {
    const part = new Uint8Array(c.data);
    body.set(part, offset);
    offset += part.byteLength;
  }
  return { mime: meta.mime, body };
}

export const removeFile = tx((name) => {
  run('DELETE FROM file_chunks WHERE name = ?', name);
  run('DELETE FROM files WHERE name = ?', name);
});
