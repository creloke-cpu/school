import crypto from 'crypto';
import { pool } from './db.js';
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export function requestId(req, res, next) { req.id = req.get('x-request-id') || crypto.randomUUID(); res.set('x-request-id', req.id); next(); }
export function errorHandler(error, req, res, next) {
  console.error({ requestId: req.id, error: error.message, providerStatus: error.providerStatus, providerDetail: error.providerDetail });
  if (res.headersSent) return next(error);
  const status = error.status || (error.code === '23505' ? 409 : 500);
  res.status(status).json({ error: status === 500 ? 'Internal server error' : error.message, requestId: req.id });
}
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in', requestId: req.id });
  next();
}
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.some((role) => req.user.roles.includes(role))) return res.status(403).json({ error: 'Forbidden', requestId: req.id });
  next();
};
export async function loadUser(req, res, next) {
  const token = req.cookies?.crelo_session;
  if (token) {
    const { rows } = await pool.query(`SELECT u.id,u.contact,u.display_name,COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL),'{}') roles
      FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id
      WHERE s.session_hash=$1 AND s.expires_at>NOW() GROUP BY u.id`, [crypto.createHash('sha256').update(token).digest('hex')]);
    req.user = rows[0] || null;
  }
  next();
}
