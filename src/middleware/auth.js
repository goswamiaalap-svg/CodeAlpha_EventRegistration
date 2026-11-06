/**
 * middleware/auth.js — JWT authentication middleware
 *
 * Exports:
 *  authenticate      — requires a valid token (any role)
 *  requireOrganizer  — requires role === 'organizer'
 */

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'fallback_dev_secret';

/**
 * Verifies the Bearer token in the Authorization header.
 * Attaches `req.user = { id, name, email, role }` on success.
 */
function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload; // { id, name, email, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token. Please log in again.' });
  }
}

/**
 * Must be used AFTER authenticate.
 * Rejects non-organizer users with 403.
 */
function requireOrganizer(req, res, next) {
  if (req.user?.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied. Organizer role required.' });
  }
  next();
}

module.exports = { authenticate, requireOrganizer };
