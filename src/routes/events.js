/**
 * routes/events.js — Event CRUD routes
 *
 *  GET    /api/events            — list all upcoming events (public)
 *  GET    /api/events/:id        — single event detail     (public)
 *  POST   /api/events            — create event            (organizer only)
 *  PUT    /api/events/:id        — update own event        (organizer only)
 *  DELETE /api/events/:id        — delete own event        (organizer only)
 *  GET    /api/events/:id/registrations — attendee list   (organizer only)
 *  GET    /api/events/my         — organizer's own events  (organizer only)
 */

const express  = require('express');
const {
  stmtGetAllEvents, stmtGetEventById, stmtGetEventsByOrg,
  stmtCreateEvent, stmtUpdateEvent, stmtDeleteEvent,
  stmtGetEventRegistrations,
} = require('../db');
const { authenticate, requireOrganizer } = require('../middleware/auth');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function validateEventBody(body, res) {
  const { title, description, date, time, location, capacity } = body;
  if (!title?.trim())       return res.status(400).json({ error: 'Event title is required.' });
  if (!description?.trim()) return res.status(400).json({ error: 'Description is required.' });
  if (!date)                return res.status(400).json({ error: 'Event date is required.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
                            return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format.' });
  if (!time)                return res.status(400).json({ error: 'Event time is required.' });
  if (!location?.trim())    return res.status(400).json({ error: 'Location is required.' });
  const cap = parseInt(capacity, 10);
  if (!cap || cap < 1)      return res.status(400).json({ error: 'Capacity must be a positive integer.' });
  return null; // valid
}

// ── GET /api/events (public) ──────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const events = stmtGetAllEvents.all();
    return res.json(events);
  } catch (err) {
    console.error('[GET /events]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/events/my (organizer) ───────────────────────────────────────────
// MUST be before /:id to avoid "my" being treated as an id
router.get('/my', authenticate, requireOrganizer, (req, res) => {
  try {
    const events = stmtGetEventsByOrg.all(req.user.id);
    return res.json(events);
  } catch (err) {
    console.error('[GET /events/my]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/events/:id (public) ─────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const event = stmtGetEventById.get(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    return res.json(event);
  } catch (err) {
    console.error('[GET /events/:id]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/events (organizer) ─────────────────────────────────────────────
router.post('/', authenticate, requireOrganizer, (req, res) => {
  try {
    const err = validateEventBody(req.body, res);
    if (err) return; // response already sent

    const { title, description, date, time, location, capacity } = req.body;
    const result = stmtCreateEvent.run(
      title.trim(), description.trim(), date, time, location.trim(),
      parseInt(capacity, 10), req.user.id
    );
    const created = stmtGetEventById.get(result.lastInsertRowid);
    return res.status(201).json(created);
  } catch (err) {
    console.error('[POST /events]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── PUT /api/events/:id (organizer) ──────────────────────────────────────────
router.put('/:id', authenticate, requireOrganizer, (req, res) => {
  try {
    const err = validateEventBody(req.body, res);
    if (err) return;

    const { title, description, date, time, location, capacity } = req.body;
    const result = stmtUpdateEvent.run(
      title.trim(), description.trim(), date, time, location.trim(),
      parseInt(capacity, 10), req.params.id, req.user.id
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Event not found or you are not the organizer.' });
    }
    return res.json(stmtGetEventById.get(req.params.id));
  } catch (err) {
    console.error('[PUT /events/:id]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── DELETE /api/events/:id (organizer) ───────────────────────────────────────
router.delete('/:id', authenticate, requireOrganizer, (req, res) => {
  try {
    const result = stmtDeleteEvent.run(req.params.id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Event not found or you are not the organizer.' });
    }
    return res.json({ message: 'Event deleted successfully.' });
  } catch (err) {
    console.error('[DELETE /events/:id]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/events/:id/registrations (organizer) ────────────────────────────
router.get('/:id/registrations', authenticate, requireOrganizer, (req, res) => {
  try {
    const event = stmtGetEventById.get(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    if (event.organizer_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not the organizer of this event.' });
    }
    const registrations = stmtGetEventRegistrations.all(req.params.id);
    return res.json({ event, registrations });
  } catch (err) {
    console.error('[GET /events/:id/registrations]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
