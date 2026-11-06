/**
 * Runtime detection + hooks shared by the Node server and the Cloudflare Worker build.
 * The Worker entry (server/cf/worker.js) fills in the hooks at startup.
 */
export const IS_WORKER = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

export const runtime = {
  /** Remove an uploaded file by its public URL (/uploads/...). Node uses the disk; the Worker uses SQLite. */
  removeUpload: null,
  /** Origin of the most recent request (used as PUBLIC_URL fallback on Cloudflare). */
  origin: '',
  /** Session-signing secret persisted in the database when JWT_SECRET is not configured (Cloudflare). */
  jwtSecret: '',
};
