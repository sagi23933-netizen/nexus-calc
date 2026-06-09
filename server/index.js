import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import './db.js';
import authRoutes from './routes/auth.js';
import agentsRoutes from './routes/agents.js';
import projectsRoutes from './routes/projects.js';
import workflowsRoutes from './routes/workflows.js';
import apiKeysRoutes from './routes/apiKeys.js';
import integrationsRoutes from './routes/integrations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cors({ origin: true, credentials: true }));
if (NODE_ENV !== 'test') app.use(morgan('tiny'));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: NODE_ENV, time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/api/integrations', integrationsRoutes);

const distDir = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('[server error]', err);
  res.status(err.status || 500).json({ error: err.code || 'internal_error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`[nexus-server] listening on http://localhost:${PORT}`);
});
