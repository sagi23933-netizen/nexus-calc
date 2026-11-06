/**
 * A small Express-compatible layer for Cloudflare Workers: the same Router API the route
 * modules use (use/get/post/put/patch/delete, :params, async handlers, next(err)), plus
 * request/response objects built from the Fetch API.
 */
const encoder = new TextEncoder();

function compile(path) {
  const keys = [];
  const pattern = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\/:([A-Za-z_]\w*)/g, (_, k) => {
    keys.push(k);
    return '/([^/]+)';
  });
  return { re: new RegExp(`^${pattern}/?$`), keys };
}

/** Run fn; route sync throws and rejected promises to onError (Express 5 semantics). */
function invoke(fn, onError) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') r.catch(onError);
  } catch (err) {
    onError(err);
  }
}

class RouterImpl {
  constructor() {
    this.stack = [];
  }
  use(...args) {
    const prefix = typeof args[0] === 'string' ? args.shift() : null;
    for (const handler of args) this.stack.push({ method: null, prefix, handler });
    return this;
  }
  _route(method, path, handlers) {
    const { re, keys } = compile(path);
    this.stack.push({ method, re, keys, handlers });
    return this;
  }
  get(path, ...h) {
    return this._route('GET', path, h);
  }
  post(path, ...h) {
    return this._route('POST', path, h);
  }
  put(path, ...h) {
    return this._route('PUT', path, h);
  }
  patch(path, ...h) {
    return this._route('PATCH', path, h);
  }
  delete(path, ...h) {
    return this._route('DELETE', path, h);
  }
  /** Dispatch req (req.path is relative to the mount point); `out` is called when nothing handled it. */
  handle(req, res, out) {
    let i = 0;
    const next = (err) => {
      if (res.finished) return;
      const layer = this.stack[i++];
      if (!layer) return out(err);
      if (layer.method === null) {
        if (layer.prefix && !(req.path === layer.prefix || req.path.startsWith(`${layer.prefix}/`))) return next(err);
        const h = layer.handler;
        const isErrorHandler = h.length === 4;
        if (err) return isErrorHandler ? invoke(() => h(err, req, res, next), next) : next(err);
        if (isErrorHandler) return next();
        if (h instanceof RouterImpl) return h.handle(req, res, next);
        return invoke(() => h(req, res, next), next);
      }
      if (err) return next(err);
      const methodOk = layer.method === req.method || (layer.method === 'GET' && req.method === 'HEAD');
      const m = methodOk ? layer.re.exec(req.path) : null;
      if (!m) return next();
      req.params = {};
      layer.keys.forEach((k, idx) => {
        req.params[k] = decodeURIComponent(m[idx + 1]);
      });
      let j = 0;
      const step = (e) => {
        if (res.finished) return;
        if (e) return next(e);
        const h = layer.handlers[j++];
        if (!h) return next();
        invoke(() => h(req, res, step), step);
      };
      step();
    };
    next();
  }
}

export function Router() {
  return new RouterImpl();
}

function parseCookies(header) {
  const out = {};
  for (const part of (header || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[k] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

/** Build an Express-like request from a Fetch Request. JSON bodies are parsed (200 KB limit). */
export async function createRequest(request, url) {
  const headers = request.headers;
  const req = {
    raw: request,
    method: request.method,
    url: url.pathname + url.search,
    originalUrl: url.pathname + url.search,
    path: url.pathname,
    baseUrl: '',
    hostname: url.hostname,
    protocol: url.protocol.replace(':', ''),
    query: Object.fromEntries(url.searchParams),
    params: {},
    body: {},
    cookies: parseCookies(headers.get('cookie')),
    ip: headers.get('cf-connecting-ip') || headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
    headers: Object.fromEntries(headers),
    get: (name) => headers.get(name) ?? undefined,
    header: (name) => headers.get(name) ?? undefined,
  };
  const type = headers.get('content-type') || '';
  if (!['GET', 'HEAD'].includes(request.method) && type.includes('application/json')) {
    const text = await request.text();
    if (text.length > 200_000) throw Object.assign(new Error('גוף הבקשה גדול מדי'), { status: 413 });
    try {
      req.body = text ? JSON.parse(text) : {};
    } catch {
      throw Object.assign(new Error('JSON לא תקין'), { status: 400 });
    }
  }
  return req;
}

/** Express-like response that collects headers/body and becomes a Fetch Response. */
export class ResponseBuilder {
  constructor() {
    this.statusCode = 200;
    this.headers = new Headers();
    this.cookies = [];
    this.chunks = [];
    this.finished = false;
    this.done = new Promise((resolve) => {
      this._resolve = resolve;
    });
  }
  status(code) {
    this.statusCode = code;
    return this;
  }
  setHeader(name, value) {
    this.headers.set(name, String(value));
    return this;
  }
  set(name, value) {
    return this.setHeader(name, value);
  }
  getHeader(name) {
    return this.headers.get(name);
  }
  write(chunk) {
    if (chunk == null) return true;
    this.chunks.push(typeof chunk === 'string' ? encoder.encode(chunk) : chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
    return true;
  }
  end(chunk) {
    if (this.finished) return this;
    this.write(chunk);
    this.finished = true;
    this._resolve();
    return this;
  }
  json(obj) {
    this.setHeader('Content-Type', 'application/json; charset=utf-8');
    return this.end(JSON.stringify(obj));
  }
  send(body) {
    if (body !== null && typeof body === 'object' && !(body instanceof Uint8Array) && !(body instanceof ArrayBuffer)) return this.json(body);
    if (!this.headers.has('Content-Type')) this.setHeader('Content-Type', 'text/html; charset=utf-8');
    return this.end(body);
  }
  cookie(name, value, opts = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${opts.path || '/'}`];
    if (opts.maxAge != null) parts.push(`Max-Age=${Math.floor(opts.maxAge / 1000)}`);
    if (opts.httpOnly) parts.push('HttpOnly');
    if (opts.secure) parts.push('Secure');
    if (opts.sameSite) parts.push(`SameSite=${opts.sameSite[0].toUpperCase()}${opts.sameSite.slice(1)}`);
    this.cookies.push(parts.join('; '));
    return this;
  }
  clearCookie(name, opts = {}) {
    this.cookies.push(`${name}=; Path=${opts.path || '/'}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    return this;
  }
  toResponse() {
    const size = this.chunks.reduce((n, c) => n + c.byteLength, 0);
    const body = new Uint8Array(size);
    let offset = 0;
    for (const c of this.chunks) {
      body.set(c, offset);
      offset += c.byteLength;
    }
    for (const c of this.cookies) this.headers.append('Set-Cookie', c);
    return new Response(this.statusCode === 204 ? null : body, { status: this.statusCode, headers: this.headers });
  }
}

function express() {
  throw new Error('express() app is not available in the Worker build — see server/cf/worker.js');
}
express.Router = Router;
export default express;
