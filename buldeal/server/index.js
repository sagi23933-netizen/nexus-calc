import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { config, ROOT, UPLOAD_DIR } from './config.js';
import { one } from './db.js';
import { csrfGuard, loadUser } from './lib/auth.js';
import { HttpError } from './lib/utils.js';
import { ensureAdmin, seedBase } from './seed.js';
import { seedDemo } from './demo.js';
import { startScheduler } from './services/scheduler.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import businessRoutes from './routes/business.js';
import adminRoutes from './routes/admin.js';

seedBase();
await ensureAdmin();
if (config.seedDemo && !one('SELECT id FROM businesses LIMIT 1')) {
  await seedDemo();
  console.log('[buldeal] נתוני הדגמה נטענו (סיסמת עסקי הדגמה: Demo1234)');
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(compression());
app.use(morgan(config.isProd ? 'combined' : 'dev', { skip: (req) => req.path === '/api/public/track' }));
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use('/api', loadUser, csrfGuard);

app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'נתיב API לא קיים')));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));

const dist = path.join(ROOT, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[error]', req.method, req.path, err);
  res.status(status).json({ error: status >= 500 && config.isProd ? 'שגיאת שרת' : err.message || 'שגיאה', code: err.code });
});

app.listen(config.port, () => {
  console.log(`[buldeal] השרת פועל על http://localhost:${config.port}`);
  startScheduler();
});
