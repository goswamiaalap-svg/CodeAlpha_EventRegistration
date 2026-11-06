/**
 * db.js — SQLite database setup for Event Registration System
 *
 * Schema:
 *  users         — accounts (attendees & organizers)
 *  events        — events created by organizers
 *  registrations — many-to-many between users and events
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'events.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON'); // enforce FK constraints

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'user'  CHECK(role IN ('user','organizer')),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL,
    date        TEXT    NOT NULL,   -- ISO date  YYYY-MM-DD
    time        TEXT    NOT NULL,   -- HH:MM
    location    TEXT    NOT NULL,
    capacity    INTEGER NOT NULL CHECK(capacity > 0),
    organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    event_id      INTEGER NOT NULL REFERENCES events(id)  ON DELETE CASCADE,
    status        TEXT    NOT NULL DEFAULT 'registered'   CHECK(status IN ('registered','cancelled')),
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, event_id)   -- one registration per user per event
  );

  CREATE INDEX IF NOT EXISTS idx_events_date        ON events(date);
  CREATE INDEX IF NOT EXISTS idx_events_organizer   ON events(organizer_id);
  CREATE INDEX IF NOT EXISTS idx_reg_user           ON registrations(user_id);
  CREATE INDEX IF NOT EXISTS idx_reg_event          ON registrations(event_id);
`);

// ── Seed sample events if DB is empty ────────────────────────────────────────
const eventCount = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
if (eventCount === 0) {
  // Create a demo organizer
  const bcrypt = require('bcryptjs');
  const hash   = bcrypt.hashSync('organizer123', 10);
  const orgId  = db.prepare(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)`
  ).run('Demo Organizer', 'organizer@demo.com', hash, 'organizer').lastInsertRowid;

  const insertEvent = db.prepare(`
    INSERT INTO events (title, description, date, time, location, capacity, organizer_id)
    VALUES (?,?,?,?,?,?,?)
  `);

  insertEvent.run('Tech Summit 2026',       'Annual technology conference covering AI, Web3, and Cloud Computing. Keynotes from industry leaders.', '2026-12-15', '09:00', 'Convention Centre, Mumbai',  200, orgId);
  insertEvent.run('React Workshop',         'Hands-on workshop for building modern React apps with hooks, context, and performance optimisation.',   '2026-12-20', '10:00', 'TechHub, Bangalore',          50,  orgId);
  insertEvent.run('Startup Pitch Night',   '10 early-stage startups pitch to a panel of VCs. Networking dinner included after the event.',          '2026-12-28', '18:00', 'The Garage, Delhi',           150, orgId);
  insertEvent.run('Open Source Hackathon', '48-hour hackathon building open source tools. Teams of 2-4. Prizes for top 3 projects.',               '2027-01-10', '08:00', 'IIT Campus, Chennai',         300, orgId);
  insertEvent.run('UX Design Bootcamp',    'Two-day intensive bootcamp on user research, wireframing, and prototyping with Figma.',                '2027-01-18', '09:30', 'Design Studio, Pune',         40,  orgId);
}

// ── Prepared statements ───────────────────────────────────────────────────────

// Users
const stmtGetUserByEmail = db.prepare(`SELECT * FROM users WHERE email = ?`);
const stmtGetUserById    = db.prepare(`SELECT id, name, email, role, created_at FROM users WHERE id = ?`);
const stmtCreateUser     = db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)`);

// Events (with registration count + available spots)
const BASE_EVENT_QUERY = `
  SELECT e.*,
         u.name  AS organizer_name,
         (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'registered') AS registered_count,
         (e.capacity - (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'registered')) AS spots_left
  FROM events e JOIN users u ON u.id = e.organizer_id
`;
const stmtGetAllEvents    = db.prepare(`${BASE_EVENT_QUERY} ORDER BY e.date ASC, e.time ASC`);
const stmtGetEventById    = db.prepare(`${BASE_EVENT_QUERY} WHERE e.id = ?`);
const stmtGetEventsByOrg  = db.prepare(`${BASE_EVENT_QUERY} WHERE e.organizer_id = ? ORDER BY e.date ASC`);
const stmtCreateEvent     = db.prepare(`INSERT INTO events (title,description,date,time,location,capacity,organizer_id) VALUES (?,?,?,?,?,?,?)`);
const stmtUpdateEvent     = db.prepare(`UPDATE events SET title=?,description=?,date=?,time=?,location=?,capacity=? WHERE id=? AND organizer_id=?`);
const stmtDeleteEvent     = db.prepare(`DELETE FROM events WHERE id=? AND organizer_id=?`);

// Registrations
const stmtGetRegistration        = db.prepare(`SELECT * FROM registrations WHERE user_id=? AND event_id=?`);
const stmtCreateRegistration     = db.prepare(`INSERT INTO registrations (user_id,event_id) VALUES (?,?)`);
const stmtCancelRegistration     = db.prepare(`UPDATE registrations SET status='cancelled' WHERE id=? AND user_id=?`);
const stmtGetMyRegistrations     = db.prepare(`
  SELECT r.id, r.status, r.registered_at,
         e.id AS event_id, e.title, e.date, e.time, e.location, e.capacity,
         u.name AS organizer_name
  FROM registrations r
  JOIN events e ON e.id = r.event_id
  JOIN users  u ON u.id = e.organizer_id
  WHERE r.user_id = ?
  ORDER BY e.date ASC
`);
const stmtGetEventRegistrations  = db.prepare(`
  SELECT r.id, r.status, r.registered_at,
         u.id AS user_id, u.name, u.email
  FROM registrations r JOIN users u ON u.id = r.user_id
  WHERE r.event_id = ?
  ORDER BY r.registered_at ASC
`);

module.exports = {
  db,
  stmtGetUserByEmail, stmtGetUserById, stmtCreateUser,
  stmtGetAllEvents, stmtGetEventById, stmtGetEventsByOrg,
  stmtCreateEvent, stmtUpdateEvent, stmtDeleteEvent,
  stmtGetRegistration, stmtCreateRegistration, stmtCancelRegistration,
  stmtGetMyRegistrations, stmtGetEventRegistrations,
};
