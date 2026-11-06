/**
 * routes/registrations.js — Registration management routes
 *
 *  POST   /api/registrations           — register for an event   (user)
 *  GET    /api/registrations/my        — view own registrations  (user)
 *  DELETE /api/registrations/:id       — cancel a registration   (user)
 */

const express = require('express');
const {
  stmtGetEventById, stmtGetRegistration,
  stmtCreateRegistration, stmtCancelRegistration,
  stmtGetMyRegistrations,
} = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/registrations ───────────────────────────────────────────────────
router.post('/', authenticate, (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required.' });

    // Check event exists
    const event = stmtGetEventById.get(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    // Don't let organizers register for events (they manage them)
    if (req.user.role === 'organizer' && event.organizer_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot register for your own event.' });
    }

    // Check if already registered
    const existing = stmtGetRegistration.get(req.user.id, eventId);
    if (existing) {
      if (existing.status === 'registered') {
        return res.status(409).json({ error: 'You are already registered for this event.' });
      }
      // Was cancelled — reactivate by re-inserting won't work (UNIQUE), handle by updating
      const { db } = require('../db');
      db.prepare(`UPDATE registrations SET status='registered', registered_at=CURRENT_TIMESTAMP WHERE user_id=? AND event_id=?`)
        .run(req.user.id, eventId);
      return res.status(200).json({ message: 'Registration reactivated successfully.', eventId });
    }

    // Check capacity
    if (event.spots_left <= 0) {
      return res.status(400).json({ error: 'Sorry, this event is fully booked.' });
    }

    stmtCreateRegistration.run(req.user.id, eventId);
    return res.status(201).json({
      message: `Successfully registered for "${event.title}"!`,
      eventId,
    });
  } catch (err) {
    console.error('[POST /registrations]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/registrations/my ─────────────────────────────────────────────────
router.get('/my', authenticate, (req, res) => {
  try {
    const registrations = stmtGetMyRegistrations.all(req.user.id);
    return res.json(registrations);
  } catch (err) {
    console.error('[GET /registrations/my]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── DELETE /api/registrations/:id (cancel) ───────────────────────────────────
router.delete('/:id', authenticate, (req, res) => {
  try {
    const result = stmtCancelRegistration.run(req.params.id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Registration not found or already cancelled.' });
    }
    return res.json({ message: 'Registration cancelled successfully.' });
  } catch (err) {
    console.error('[DELETE /registrations/:id]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
