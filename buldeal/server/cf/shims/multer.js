/**
 * multer replacement for Cloudflare: reads the multipart body with Request.formData()
 * and stores the file in the Durable Object database (server/cf/files.js).
 */
import { saveFile } from '../files.js';

function multer({ storage, limits = {}, fileFilter } = {}) {
  return {
    single(field) {
      return (req, _res, cb) => {
        (async () => {
          const form = await req.raw.formData();
          const file = form.get(field);
          if (!file || typeof file === 'string') return cb();
          const meta = { fieldname: field, originalname: file.name || 'file', mimetype: file.type || 'application/octet-stream', size: file.size };
          if (limits.fileSize && file.size > limits.fileSize) {
            const err = new Error('File too large');
            err.code = 'LIMIT_FILE_SIZE';
            return cb(err);
          }
          if (fileFilter) {
            const ok = await new Promise((resolve, reject) => fileFilter(req, meta, (err, accept) => (err ? reject(err) : resolve(accept))));
            if (!ok) return cb();
          }
          const filename = storage?._filename
            ? await new Promise((resolve, reject) => storage._filename(req, meta, (err, name) => (err ? reject(err) : resolve(name))))
            : `${Date.now().toString(36)}-${crypto.randomUUID()}`;
          saveFile(filename, meta.mimetype, new Uint8Array(await file.arrayBuffer()));
          req.file = { ...meta, filename };
          cb();
        })().catch(cb);
      };
    },
  };
}
multer.diskStorage = (opts) => ({ _filename: opts.filename });
export default multer;
