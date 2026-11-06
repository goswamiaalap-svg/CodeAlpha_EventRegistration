/**
 * routes/auth.js — Authentication routes
 *
 *  POST /api/auth/register  — create a new account
 *  POST /api/auth/login     — login and receive a JWT
 *  GET  /api/auth/me        — return current user profile (requires token)
 */

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { stmtGetUserByEmail, stmtCreateUser, stmtGetUserById } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'fallback_dev_secret';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

// Rate-limit auth endpoints to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'Too many attempts. Please wait 15 minutes.' },
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (name.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    }
    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Only allow 'user' or 'organizer'
    const userRole = role === 'organizer' ? 'organizer' : 'user';

    // Check duplicate email
    if (stmtGetUserByEmail.get(email.toLowerCase())) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password and insert
    const hash   = await bcrypt.hash(password, 10);
    const result = stmtCreateUser.run(name.trim(), email.toLowerCase(), hash, userRole);

    // Issue JWT
    const token = jwt.sign(
      { id: result.lastInsertRowid, name: name.trim(), email: email.toLowerCase(), role: userRole },
      SECRET,
      { expiresIn: EXPIRES }
    );

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: { id: result.lastInsertRowid, name: name.trim(), email: email.toLowerCase(), role: userRole },
    });
  } catch (err) {
    console.error('[POST /auth/register]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = stmtGetUserByEmail.get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      SECRET,
      { expiresIn: EXPIRES }
    );

    return res.json({
      message: 'Login successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[POST /auth/login]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const user = stmtGetUserById.get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  return res.json(user);
});

module.exports = router;
