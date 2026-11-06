/** In-memory express-rate-limit replacement (the single Durable Object makes it global). */
export default function rateLimit({ windowMs = 60_000, limit = 60, message } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'anon';
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    if (entry.count > limit) {
      res.setHeader('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json(typeof message === 'object' && message ? message : { error: 'יותר מדי בקשות. נסו שוב בעוד רגע.' });
    }
    next();
  };
}
