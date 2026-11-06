# 🎫 EventHub — Event Registration System

A full-stack Event Registration System built for **CodeAlpha Backend Internship (Task 2)** using **Node.js**, **Express.js**, **SQLite (`better-sqlite3`)**, and **JWT authentication**.

---

## 🌟 Features

- **Public Event Catalog**: Browse upcoming events with live spot counts and search filter.
- **User Authentication**: Secure JWT-based auth with password hashing (`bcryptjs`) for Attendees and Organizers.
- **Event Registration**: One-click registration with real-time capacity checks and duplicate registration prevention.
- **Attendee Dashboard**: View all registered events and cancel registrations at any time.
- **Organizer Panel**:
  - Create, edit, and delete hosted events.
  - View attendee roster (name, email, registration status, timestamp).
  - Track live registration count vs capacity.
- **Seed Data**: Automatically seeds 5 sample events and a demo organizer account on first run.

---

## 🏗️ Database Schema

### `users`
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT)
- `email` (TEXT UNIQUE)
- `password_hash` (TEXT)
- `role` ('user' | 'organizer')
- `created_at` (DATETIME)

### `events`
- `id` (INTEGER PRIMARY KEY)
- `title` (TEXT)
- `description` (TEXT)
- `date` (TEXT ISO)
- `time` (TEXT)
- `location` (TEXT)
- `capacity` (INTEGER)
- `organizer_id` (FOREIGN KEY -> users.id)
- `created_at` (DATETIME)

### `registrations`
- `id` (INTEGER PRIMARY KEY)
- `user_id` (FOREIGN KEY -> users.id)
- `event_id` (FOREIGN KEY -> events.id)
- `status` ('registered' | 'cancelled')
- `registered_at` (DATETIME)
- *Constraint: UNIQUE(user_id, event_id)*

---

## 🚀 Setup & Run

### 1. Install Dependencies
```bash
cd Task2-Event-Registration
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Default port is `3001` (to run alongside Task 1 on 3000).

### 3. Start Server
```bash
npm start
# or for live reload:
npm run dev
```

Visit: **http://localhost:3001**

### 🔑 Demo Accounts
- **Organizer**: `organizer@demo.com` / `organizer123`
- Or register your own attendee or organizer account directly from the UI!

---

## 📡 API Endpoints

### Auth
- `POST /api/auth/register` — Register a new account (`name`, `email`, `password`, `role`)
- `POST /api/auth/login` — Login & receive JWT token
- `GET /api/auth/me` — Get current logged-in user details (Bearer Token)

### Events
- `GET /api/events` — List all upcoming events with remaining spots (Public)
- `GET /api/events/:id` — Get single event details (Public)
- `POST /api/events` — Create new event (Organizer only)
- `PUT /api/events/:id` — Update event (Organizer only)
- `DELETE /api/events/:id` — Delete event (Organizer only)
- `GET /api/events/my` — Get organizer's hosted events (Organizer only)
- `GET /api/events/:id/registrations` — View event attendee list (Organizer only)

### Registrations
- `POST /api/registrations` — Register current user for an event (Bearer Token)
- `GET /api/registrations/my` — List all events registered by current user (Bearer Token)
- `DELETE /api/registrations/:id` — Cancel registration (Bearer Token)
