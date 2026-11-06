/**
 * EventHub Frontend Client
 * Handles Auth, Event Browsing, Registrations, and Organizer actions
 */

(function () {
  'use strict';

  const API_BASE = '/api';

  // ── State ──────────────────────────────────────────────────────────────
  let currentUser = null;
  let token = localStorage.getItem('eventhub_token') || null;
  let allEvents = [];

  // ── Elements ───────────────────────────────────────────────────────────
  const tabButtons = document.querySelectorAll('.nav-tab');
  const tabViews = document.querySelectorAll('.tab-view');
  const tabMyRegs = document.getElementById('tab-my-regs');
  const tabOrganizer = document.getElementById('tab-organizer');

  const authButtons = document.getElementById('auth-buttons');
  const userProfile = document.getElementById('user-profile');
  const userDisplayName = document.getElementById('user-display-name');
  const userRoleBadge = document.getElementById('user-role-badge');
  const userAvatar = document.getElementById('user-avatar');
  const logoutBtn = document.getElementById('logout-btn');

  const authModal = document.getElementById('auth-modal');
  const openLoginBtn = document.getElementById('open-login-btn');
  const openRegisterBtn = document.getElementById('open-register-btn');
  const closeAuthModal = document.getElementById('close-auth-modal');
  const authTabLogin = document.getElementById('auth-tab-login');
  const authTabRegister = document.getElementById('auth-tab-register');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  const eventsGrid = document.getElementById('events-grid');
  const searchInput = document.getElementById('search-input');
  const registrationsList = document.getElementById('registrations-list');

  // Organizer elements
  const eventModal = document.getElementById('event-modal');
  const btnCreateEventModal = document.getElementById('btn-create-event-modal');
  const closeEventModal = document.getElementById('close-event-modal');
  const createEventForm = document.getElementById('create-event-form');
  const organizerEventsList = document.getElementById('organizer-events-list');

  // Attendees modal
  const attendeesModal = document.getElementById('attendees-modal');
  const closeAttendeesModal = document.getElementById('close-attendees-modal');
  const attendeesModalTitle = document.getElementById('attendees-modal-title');
  const attendeesModalContent = document.getElementById('attendees-modal-content');

  const alertBanner = document.getElementById('alert-banner');

  // ── Helper: Alert Banner ───────────────────────────────────────────────
  function showAlert(message, type = 'success', timeout = 4000) {
    alertBanner.textContent = message;
    alertBanner.className = `alert-banner alert-${type}`;
    if (timeout) {
      setTimeout(() => {
        alertBanner.classList.add('hidden');
      }, timeout);
    }
  }

  // ── Helper: API Request ────────────────────────────────────────────────
  async function api(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong');
    }
    return data;
  }

  // ── Auth Handling ──────────────────────────────────────────────────────
  async function checkAuth() {
    if (!token) {
      updateAuthUI(null);
      return;
    }
    try {
      const user = await api('/auth/me');
      currentUser = user;
      updateAuthUI(user);
    } catch {
      logout();
    }
  }

  function updateAuthUI(user) {
    if (user) {
      authButtons.style.display = 'none';
      userProfile.style.display = 'flex';
      userDisplayName.textContent = user.name;
      userRoleBadge.textContent = user.role;
      userAvatar.textContent = user.name.charAt(0).toUpperCase();

      tabMyRegs.style.display = 'inline-block';
      if (user.role === 'organizer') {
        tabOrganizer.style.display = 'inline-block';
      } else {
        tabOrganizer.style.display = 'none';
      }
    } else {
      authButtons.style.display = 'flex';
      userProfile.style.display = 'none';
      tabMyRegs.style.display = 'none';
      tabOrganizer.style.display = 'none';
      switchTab('events');
    }
  }

  function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('eventhub_token');
    updateAuthUI(null);
    showAlert('Logged out successfully', 'success');
    loadEvents();
  }

  // ── Tab Navigation ─────────────────────────────────────────────────────
  function switchTab(tabId) {
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    tabViews.forEach(view => {
      view.classList.toggle('active', view.id === `view-${tabId}`);
    });

    if (tabId === 'events') loadEvents();
    if (tabId === 'my-registrations') loadMyRegistrations();
    if (tabId === 'organizer') loadOrganizerEvents();
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ── Modal Handlers ─────────────────────────────────────────────────────
  openLoginBtn.addEventListener('click', () => {
    authModal.classList.remove('hidden');
    authTabLogin.click();
  });

  openRegisterBtn.addEventListener('click', () => {
    authModal.classList.remove('hidden');
    authTabRegister.click();
  });

  closeAuthModal.addEventListener('click', () => authModal.classList.add('hidden'));

  authTabLogin.addEventListener('click', () => {
    authTabLogin.classList.add('active');
    authTabRegister.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  });

  authTabRegister.addEventListener('click', () => {
    authTabRegister.classList.add('active');
    authTabLogin.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  });

  // ── Form Submit: Login & Register ──────────────────────────────────────
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const res = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      token = res.token;
      localStorage.setItem('eventhub_token', token);
      currentUser = res.user;
      updateAuthUI(currentUser);
      authModal.classList.add('hidden');
      showAlert(`Welcome back, ${currentUser.name}!`);
      loadEvents();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const name = document.getElementById('reg-name').value;
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      const role = document.getElementById('reg-role').value;
      const res = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role })
      });
      token = res.token;
      localStorage.setItem('eventhub_token', token);
      currentUser = res.user;
      updateAuthUI(currentUser);
      authModal.classList.add('hidden');
      showAlert(`Welcome to EventHub, ${currentUser.name}!`);
      loadEvents();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  });

  logoutBtn.addEventListener('click', logout);

  // ── Browse Events ──────────────────────────────────────────────────────
  async function loadEvents() {
    try {
      eventsGrid.innerHTML = '<div class="loading-state">Loading events...</div>';
      const events = await api('/events');
      allEvents = events;
      renderEvents(allEvents);
    } catch (err) {
      eventsGrid.innerHTML = `<div class="empty-state">Error loading events: ${err.message}</div>`;
    }
  }

  function renderEvents(events) {
    if (!events.length) {
      eventsGrid.innerHTML = '<div class="empty-state">No events found matching your search.</div>';
      return;
    }

    eventsGrid.innerHTML = events.map(evt => {
      const isFull = evt.spots_left <= 0;
      const dateFormatted = new Date(`${evt.date}T${evt.time}`).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
      });

      return `
        <article class="event-card">
          <div class="event-badge-row">
            <span class="date-badge">📅 ${dateFormatted} · ${evt.time}</span>
            <span class="spots-badge ${isFull ? 'full' : 'available'}">
              ${isFull ? 'Sold Out' : `${evt.spots_left} spots left`}
            </span>
          </div>

          <h3 class="event-card-title">${escapeHtml(evt.title)}</h3>
          <p class="event-card-desc">${escapeHtml(evt.description)}</p>

          <div class="event-meta">
            <div class="meta-item">📍 <strong>Location:</strong> ${escapeHtml(evt.location)}</div>
            <div class="meta-item">👤 <strong>Organizer:</strong> ${escapeHtml(evt.organizer_name)}</div>
            <div class="meta-item">👥 <strong>Capacity:</strong> ${evt.registered_count} / ${evt.capacity} registered</div>
          </div>

          <div class="event-card-footer">
            <button class="btn btn-primary register-btn" data-id="${evt.id}" ${isFull ? 'disabled' : ''}>
              ${isFull ? 'Event Full' : 'Register Now'}
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Attach registration listeners
    document.querySelectorAll('.register-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        handleRegister(id);
      });
    });
  }

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = allEvents.filter(evt =>
      evt.title.toLowerCase().includes(q) ||
      evt.location.toLowerCase().includes(q) ||
      evt.description.toLowerCase().includes(q)
    );
    renderEvents(filtered);
  });

  async function handleRegister(eventId) {
    if (!currentUser) {
      showAlert('Please log in or create an account to register.', 'error');
      openLoginBtn.click();
      return;
    }

    try {
      const res = await api('/registrations', {
        method: 'POST',
        body: JSON.stringify({ eventId: Number(eventId) })
      });
      showAlert(res.message || 'Successfully registered!');
      loadEvents();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  }

  // ── My Registrations ───────────────────────────────────────────────────
  async function loadMyRegistrations() {
    try {
      registrationsList.innerHTML = '<div class="loading-state">Loading your registrations...</div>';
      const regs = await api('/registrations/my');

      if (!regs.length) {
        registrationsList.innerHTML = `
          <div class="empty-state">
            <p>You haven't registered for any events yet.</p>
            <button class="btn btn-outline" style="margin-top:1rem;" onclick="document.querySelector('[data-tab=events]').click()">Browse Events</button>
          </div>
        `;
        return;
      }

      registrationsList.innerHTML = regs.map(r => `
        <div class="reg-card">
          <div>
            <span class="reg-status ${r.status}">${r.status}</span>
            <h3 style="font-size:1.15rem; margin-bottom:0.25rem;">${escapeHtml(r.title)}</h3>
            <p style="color:var(--text-muted); font-size:0.85rem;">
              📅 ${r.date} at ${r.time} &nbsp;|&nbsp; 📍 ${escapeHtml(r.location)} &nbsp;|&nbsp; 👤 Host: ${escapeHtml(r.organizer_name)}
            </p>
          </div>
          <div>
            ${r.status === 'registered' ? `
              <button class="btn btn-danger-sm cancel-reg-btn" data-id="${r.id}">
                Cancel Registration
              </button>
            ` : '<span style="color:var(--text-muted); font-size:0.82rem;">Cancelled</span>'}
          </div>
        </div>
      `).join('');

      document.querySelectorAll('.cancel-reg-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (!confirm('Are you sure you want to cancel this registration?')) return;
          try {
            await api(`/registrations/${e.target.dataset.id}`, { method: 'DELETE' });
            showAlert('Registration cancelled.');
            loadMyRegistrations();
          } catch (err) {
            showAlert(err.message, 'error');
          }
        });
      });
    } catch (err) {
      registrationsList.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  // ── Organizer Dashboard ────────────────────────────────────────────────
  btnCreateEventModal.addEventListener('click', () => eventModal.classList.remove('hidden'));
  closeEventModal.addEventListener('click', () => eventModal.classList.add('hidden'));

  createEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const title = document.getElementById('event-title').value;
      const description = document.getElementById('event-desc').value;
      const date = document.getElementById('event-date').value;
      const time = document.getElementById('event-time').value;
      const capacity = document.getElementById('event-cap').value;
      const location = document.getElementById('event-loc').value;

      await api('/events', {
        method: 'POST',
        body: JSON.stringify({ title, description, date, time, capacity, location })
      });

      showAlert('Event created successfully!');
      eventModal.classList.add('hidden');
      createEventForm.reset();
      loadOrganizerEvents();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  });

  async function loadOrganizerEvents() {
    try {
      organizerEventsList.innerHTML = '<div class="loading-state">Loading your hosted events...</div>';
      const events = await api('/events/my');

      if (!events.length) {
        organizerEventsList.innerHTML = '<div class="empty-state">You have not hosted any events yet. Click "+ Create New Event" to get started.</div>';
        return;
      }

      organizerEventsList.innerHTML = `
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Date & Time</th>
                <th>Location</th>
                <th>Registrations</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${events.map(e => `
                <tr>
                  <td><strong>${escapeHtml(e.title)}</strong></td>
                  <td>${e.date} · ${e.time}</td>
                  <td>${escapeHtml(e.location)}</td>
                  <td>${e.registered_count} / ${e.capacity}</td>
                  <td>
                    <button class="btn btn-secondary-sm view-attendees-btn" data-id="${e.id}" data-title="${escapeHtml(e.title)}">Attendees</button>
                    <button class="btn btn-danger-sm delete-event-btn" data-id="${e.id}">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      document.querySelectorAll('.view-attendees-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          showAttendees(e.target.dataset.id, e.target.dataset.title);
        });
      });

      document.querySelectorAll('.delete-event-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (!confirm('Are you sure you want to delete this event? All associated registrations will also be removed.')) return;
          try {
            await api(`/events/${e.target.dataset.id}`, { method: 'DELETE' });
            showAlert('Event deleted.');
            loadOrganizerEvents();
          } catch (err) {
            showAlert(err.message, 'error');
          }
        });
      });
    } catch (err) {
      organizerEventsList.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  async function showAttendees(eventId, title) {
    attendeesModalTitle.textContent = `Attendees for "${title}"`;
    attendeesModalContent.innerHTML = '<div class="loading-state">Loading attendees...</div>';
    attendeesModal.classList.remove('hidden');

    try {
      const data = await api(`/events/${eventId}/registrations`);
      const list = data.registrations;

      if (!list.length) {
        attendeesModalContent.innerHTML = '<p class="empty-state">No attendees registered for this event yet.</p>';
        return;
      }

      attendeesModalContent.innerHTML = `
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Registered At</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(a => `
                <tr>
                  <td><strong>${escapeHtml(a.name)}</strong></td>
                  <td>${escapeHtml(a.email)}</td>
                  <td><span class="reg-status ${a.status}">${a.status}</span></td>
                  <td>${new Date(a.registered_at).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      attendeesModalContent.innerHTML = `<p class="empty-state">Error: ${err.message}</p>`;
    }
  }

  closeAttendeesModal.addEventListener('click', () => attendeesModal.classList.add('hidden'));

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ── Init ───────────────────────────────────────────────────────────────
  checkAuth();
  loadEvents();
})();
