import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool, migrate } from './src/db.js';
import { asyncHandler, errorHandler, requestId } from './src/middleware.js';
import { authRouter } from './src/routes/auth.js';
import { platformRouter } from './src/routes/platform.js';

const app = express();
const PORT = process.env.PORT || 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const origin = process.env.WEB_ORIGIN;

app.use(requestId);
app.use(helmet());
app.use(cors({ origin: origin ? origin.split(',').map((v) => v.trim()) : false, credentials: true }));
app.use(express.json({ limit: process.env.BODY_LIMIT || '100kb' }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again later.' },
});

app.get('/api/test', (req, res) => res.json({ message: 'RoadReady API', status: 'Connected', requestId: req.id }));
app.get('/api/db/health', asyncHandler(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'Connected', requestId: req.id });
}));
app.get('/api/health', asyncHandler(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'up', requestId: req.id });
}));
app.get('/api/ready', asyncHandler(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ready', requestId: req.id });
}));

app.use('/api/auth', authLimiter, authRouter);
app.use('/api', platformRouter);

// Existing records API remains intentionally unchanged.
app.get('/api/records', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, created_at FROM records ORDER BY created_at DESC');
  res.json(rows);
}));
app.post('/api/records', asyncHandler(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ error: 'name is required' });
  const { rows } = await pool.query('INSERT INTO records (name) VALUES ($1) RETURNING id, name, created_at', [name]);
  res.status(201).json(rows[0]);
}));

app.use(errorHandler);
const distPath = path.resolve(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => req.path.startsWith('/api')
    ? res.status(404).json({ error: 'API route not found' })
    : res.sendFile(path.join(distPath, 'index.html')));
} else app.get('/', (req, res) => res.send('RoadReady API is active'));

if (process.env.NODE_ENV !== 'test') {
  migrate().then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on ${PORT}`)))
    .catch((error) => { console.error('Unable to initialize database', error); process.exitCode = 1; });
}
export { app, pool };
