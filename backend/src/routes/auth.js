import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';
import { asyncHandler, loadUser, requireAuth } from '../middleware.js';
const router = Router();
const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 86400000, path: '/' };
router.use(loadUser);
router.post('/request-link', asyncHandler(async (req, res) => {
  const contact = typeof req.body?.contact === 'string' ? req.body.contact.trim().toLowerCase() : '';
  if (contact.length < 5 || contact.length > 254 || !(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact) || /^\+?[0-9 ()-]{7,20}$/.test(contact))) return res.status(400).json({ error: 'Enter a valid email address or mobile number.' });
  const { rows } = await pool.query(`INSERT INTO users(contact) VALUES($1) ON CONFLICT(contact) DO UPDATE SET contact=EXCLUDED.contact RETURNING id,contact`, [contact]);
  await pool.query(`INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='student' ON CONFLICT DO NOTHING`, [rows[0].id]);
  const raw = crypto.randomBytes(32).toString('hex');
  await pool.query(`INSERT INTO auth_tokens(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '15 minutes')`, [rows[0].id, hash(raw)]);
  const response = { message: 'If the contact is valid, a sign-in link has been sent.' };
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_LINKS === 'true') response.devLink = `/api/auth/verify?token=${raw}`;
  res.json(response);
}));
router.get('/verify', asyncHandler(async (req, res) => {
  const raw = typeof req.query.token === 'string' ? req.query.token : '';
  if (!raw) return res.status(400).send('Missing sign-in token');
  const { rows } = await pool.query(`UPDATE auth_tokens SET used_at=NOW() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() RETURNING user_id`, [hash(raw)]);
  if (!rows[0]) return res.status(400).send('This sign-in link is invalid or expired.');
  const session = crypto.randomBytes(32).toString('hex');
  await pool.query(`INSERT INTO sessions(user_id,session_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')`, [rows[0].user_id, hash(session)]);
  await pool.query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [rows[0].user_id]);
  res.cookie('crelo_session', session, cookieOptions).redirect('/?authenticated=true');
}));
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
router.post('/logout', asyncHandler(async (req, res) => {
  if (req.cookies?.crelo_session) await pool.query('DELETE FROM sessions WHERE session_hash=$1', [hash(req.cookies.crelo_session)]);
  res.clearCookie('crelo_session', cookieOptions).status(204).end();
}));
export { router as authRouter };
