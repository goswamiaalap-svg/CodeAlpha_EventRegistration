/**
 * server.js — Express entry point for Event Registration System
 */

require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const path     = require('path');

// Import route modules
const authRoutes          = require('./routes/auth');
const eventRoutes         = require('./routes/events');
const registrationRoutes  = require('./routes/registrations');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/events',        eventRoutes);
app.use('/api/registrations', registrationRoutes);

// ── Catch-all: serve frontend for any non-API route ───────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎫  Event Registration System running`);
  console.log(`    Local:    http://localhost:${PORT}`);
  console.log(`    API:      http://localhost:${PORT}/api/events`);
  console.log(`    Demo org: organizer@demo.com / organizer123\n`);
});

module.exports = app;
