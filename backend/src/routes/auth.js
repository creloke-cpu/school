import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';
import { asyncHandler, loadUser, requireAuth } from '../middleware.js';

const router = Router();
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 86400000, path: '/' };
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const getLinkOrigin = (req) => {
  const configuredOrigin = process.env.AUTH_LINK_ORIGIN || process.env.WEB_ORIGIN;
  if (configuredOrigin) return configuredOrigin.split(',')[0].trim().replace(/\/$/, '');
  const protocol = req.get('x-forwarded-proto')?.split(',')[0].trim() || req.protocol;
  return `${protocol}://${req.get('host')}`;
};

const sendEmail = async (contact, link) => {
  if (!process.env.RESEND_API_KEY || !process.env.AUTH_EMAIL_FROM) {
    throw new Error('Email sign-in is not configured. Set RESEND_API_KEY and AUTH_EMAIL_FROM.');
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: ['Bearer', process.env.RESEND_API_KEY].join(' '),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM,
      to: [contact],
      subject: 'Your FirstGear sign-in link',
      text: `Sign in to FirstGear: ${link}\n\nThis link expires in 15 minutes and can only be used once.`,
      html: `<p>Sign in to FirstGear by clicking the link below:</p><p><a href="${link}">Open FirstGear</a></p><p>This link expires in 15 minutes and can only be used once.</p>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider rejected the message (${response.status}): ${detail.slice(0, 300)}`);
  }
};

router.use(loadUser);
router.post('/request-link', asyncHandler(async (req, res) => {
  const contact = typeof req.body?.contact === 'string' ? req.body.contact.trim().toLowerCase() : '';
  if (contact.length < 5 || contact.length > 254 || !emailPattern.test(contact)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  const { rows } = await pool.query(`INSERT INTO users(contact) VALUES($1) ON CONFLICT(contact) DO UPDATE SET contact=EXCLUDED.contact RETURNING id,contact`, [contact]);
  await pool.query(`INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='student' ON CONFLICT DO NOTHING`, [rows[0].id]);
  const raw = crypto.randomBytes(32).toString('hex');
  await pool.query(`INSERT INTO auth_tokens(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '15 minutes')`, [rows[0].id, hash(raw)]);
  const link = `${getLinkOrigin(req)}/api/auth/verify?token=${raw}`;
  await sendEmail(contact, link);
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
