/* Автоматично добавени връзки при разделянето на монолита. */
import { STATE_KEY } from './06-state.js';
import { saveState } from './09-backend-integraciya.js';
import { Activity } from './14-data-service.js';

/* =============================================================================
   API — BACKEND INTEGRATION POINTS
   --------------------------------------------------------------------------
   This is the ONLY layer the programmer needs to rewire when adding a real
   backend (Supabase / custom Node). All UI calls go through API.* — internals
   currently use localStorage but the signatures match real REST/RPC calls.
   ============================================================================= */
const API_BASE = ''; // future: 'https://api.pravo-academy.bg/v1'

const API = {
  // --- AUTH ---
  // Future: POST /auth/register {email, password, name} → {user, token}
  async register({ email, password, name }) {
    if (!email || !password) throw new Error('Email и парола са задължителни');
    if (password.length < 8) throw new Error('Паролата трябва да е поне 8 символа');
    // MOCK: store locally
    state.user = { email: email.toLowerCase(), name: name || email.split('@')[0], emailVerified: false };
    state.userCreatedAt = Date.now();
    state.onboardingDone = false;
    saveState();
    Activity.log('auth.register', null, { email });
    // Future: backend sends verification email here
    return { user: state.user };
  },
  // Future: POST /auth/login {email, password} → {user, token}
  async login({ email, password }) {
    if (!email || !password) throw new Error('Email и парола са задължителни');
    // MOCK: accept any non-empty
    state.user = { email: email.toLowerCase(), name: state.user?.name || email.split('@')[0], emailVerified: !!state.user?.emailVerified };
    if (!state.userCreatedAt) state.userCreatedAt = Date.now();
    saveState();
    Activity.log('auth.login', null, { email });
    return { user: state.user };
  },
  async logout() {
    Activity.log('auth.logout', null, null);
    state.user = null;
    saveState();
  },
  // Future: POST /auth/forgot-password {email}
  async forgotPassword(email) {
    Activity.log('auth.forgot-password', null, { email });
    return { sent: true }; // backend sends email
  },
  // Future: POST /auth/change-password {currentPassword, newPassword}
  // NOTE: in mock mode (no backend) we don't have a real stored password,
  // so currentPassword is optional. Backend integration will enforce it.
  async changePassword({ currentPassword, newPassword }) {
    if (!newPassword || newPassword.length < 8) throw new Error('Новата парола трябва да е поне 8 символа');
    // In production: backend will verify currentPassword via bcrypt compare.
    // In mock: we just accept any new password.
    Activity.log('auth.password-change', null, null);
    return { ok: true };
  },
  // Future: POST /auth/change-email {newEmail, password} → triggers re-verification
  async changeEmail({ newEmail }) {
    if (!newEmail || !/^[^@]+@[^@]+\.[^@]+$/.test(newEmail)) throw new Error('Невалиден email');
    state.user.email = newEmail.toLowerCase();
    state.user.emailVerified = false;
    saveState();
    Activity.log('auth.email-change', null, { newEmail });
    return { ok: true };
  },

  // --- PROFILE ---
  async updateProfile(patch) {
    state.user = Object.assign({}, state.user, patch);
    saveState();
    Activity.log('profile.update', null, Object.keys(patch));
    return { user: state.user };
  },

  // --- GDPR ---
  // Future: GET /me/export → JSON of all user data
  async exportMyData() {
    return {
      profile: state.user,
      createdAt: state.userCreatedAt,
      purchased: state.purchased,
      progress: state.progress,
      srs: state.srs,
      examDrawHistory: state.examDrawHistory,
      streakDays: state.streakDays,
      notifPrefs: state.notifPrefs,
      events: state.events,
      supportTickets: state.supportTickets,
      exportedAt: new Date().toISOString(),
    };
  },
  // Future: DELETE /me — schedules account deletion with 30-day grace period
  async deleteAccount() {
    Activity.log('account.delete-request', null, null);
    // MOCK: immediate
    localStorage.removeItem(STATE_KEY);
    state.user = null;
    return { scheduledFor: Date.now() + 30 * 86400000 };
  },

  // --- PAYMENT ---
  // Future: POST /checkout/create-session {packageId} → {checkoutUrl}
  async createCheckoutSession(packageId) {
    Activity.log('checkout.start', null, { packageId });
    // MOCK: simulate Stripe Checkout
    return { checkoutUrl: '#/mock-checkout?package=' + packageId };
  },
  // Future: Stripe webhook → backend records purchase → user gets access
  // Frontend just polls /me to see latest purchases
  async listMyPurchases() {
    return (state.purchases || []).map(p => ({ ...p }));
  },

  // --- SUPPORT ---
  // Future: POST /support/tickets {subject, body}
  async createSupportTicket({ subject, body }) {
    if (!subject || !body) throw new Error('Заглавие и съдържание са задължителни');
    const ticket = {
      id: 't_' + Math.random().toString(36).slice(2, 10),
      subject, body,
      createdAt: Date.now(),
      status: 'open',
      replies: [],
      userEmail: state.user?.email,
    };
    if (!state.supportTickets) state.supportTickets = [];
    state.supportTickets.unshift(ticket);
    Activity.log('support.create', null, { subject: subject.slice(0, 40) });
    saveState();
    return ticket;
  },
  async listMyTickets() {
    return (state.supportTickets || []).slice();
  },
  // Admin: list ALL tickets (future backend will join with users)
  async adminListTickets() {
    return (state.supportTickets || []).slice();
  },
  async adminReplyTicket(ticketId, body) {
    const t = (state.supportTickets || []).find(x => x.id === ticketId);
    if (!t) throw new Error('Ticket not found');
    t.replies.push({ from: 'admin', body, at: Date.now() });
    t.status = 'replied';
    saveState();
    Activity.log('support.admin-reply', null, { ticketId });
    return t;
  },
  async adminCloseTicket(ticketId) {
    const t = (state.supportTickets || []).find(x => x.id === ticketId);
    if (!t) throw new Error('Ticket not found');
    t.status = 'closed';
    saveState();
    return t;
  },
};

function localStorageSize() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      total += (k.length + (localStorage.getItem(k) || '').length) * 2; // UTF-16
    }
  } catch (e) { /* */ }
  return total;
}
function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

export { API, API_BASE, fmtBytes, localStorageSize };
