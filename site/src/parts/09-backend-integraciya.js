/* Автоматично добавени връзки при разделянето на монолита. */
import { DEFAULT_STATE_JSON, STATE_KEY, loadState } from './06-state.js';
import { activateProfile, currentProfileId, snapshotProfile } from './07-profili.js';
import { toast } from './10-helpers.js';
import { LocalAuth, login } from './24-lokalni-akaunti.js';

/* =============================================================================
   BACKEND ИНТЕГРАЦИЯ — автоматично разпознаване.
   Ако на PA_BACKEND_URL има работещ сървър (GET /health), сайтът ползва
   истинските API-та: вход/регистрация с истински акаунти (JWT), Stripe
   плащания, покупки и синхронизация на прогреса между устройства.
   Ако няма сървър — всичко работи локално (demo режим), както досега.

   Адрес на сървъра: localStorage 'pa_api_url', иначе:
     - ако сайтът е отворен от домейн → същия домейн (nginx проксира /api)
     - ако е отворен като файл → http://localhost:3000
   ============================================================================= */
const PA_BACKEND_URL = localStorage.getItem('pa_api_url')
  || (location.protocol.startsWith('http') ? '' : 'http://localhost:3000');

let PA_BACKEND = null; // null = още не е проверено

async function backendReady() {
  if (PA_BACKEND !== null) return PA_BACKEND;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(PA_BACKEND_URL + '/health', { signal: ctrl.signal });
    clearTimeout(t);
    PA_BACKEND = r.ok;
  } catch (e) { PA_BACKEND = false; }
  if (PA_BACKEND) console.info('[backend] Свързан:', PA_BACKEND_URL || '(същия домейн)');
  return PA_BACKEND;
}

function getJwt() { return localStorage.getItem('pa_jwt'); }
function setJwt(t) { t ? localStorage.setItem('pa_jwt', t) : localStorage.removeItem('pa_jwt'); }

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const jwt = getJwt();
  if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
  const res = await fetch(PA_BACKEND_URL + path, { ...opts, headers });
  let json = {};
  try { json = await res.json(); } catch (e) { /* празно тяло */ }
  if (res.status === 401 && jwt) setJwt(null); // изтекъл токен
  if (!res.ok) throw new Error(json.message || ('Грешка ' + res.status));
  return json;
}

/* Вход/регистрация: с backend → истински акаунт (JWT); без → локален demo */
async function authSubmit(form, mode) {
  // ВНИМАНИЕ: form.name връща името на <form> елемента, не полето "name"!
  const email = (form.querySelector('input[name="email"]')?.value || '').trim();
  const password = form.querySelector('input[type="password"]')?.value || '';
  const name = (form.querySelector('input[name="name"]')?.value || '').trim();

  // Индикация за зареждане — бутонът се заключва, докато тече заявката
  const sbtn = form.querySelector('button[type="submit"]') || form.querySelector('button');
  const btnRestore = () => { if (sbtn) { sbtn.disabled = false; sbtn.textContent = sbtn.dataset.orig || sbtn.textContent; } };
  if (sbtn) {
    sbtn.dataset.orig = sbtn.textContent;
    sbtn.disabled = true;
    sbtn.textContent = mode === 'login' ? 'Влизане…' : 'Създаване…';
  }

  if (await backendReady()) {
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { email, password, name };
      const r = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
      setJwt(r.data.token);
      let profName = name || email.split('@')[0];
      try {
        const me = await apiFetch('/api/user/profile');
        profName = me.data.name || profName;
        window.PA_ROLE = me.data.role || 'student';
      } catch (e) { /* профилът не е критичен */ }
      login(email, profName);         // локалните профили остават (кеш на устройството)
      await backendPostLogin();       // покупки + прогрес от сървъра
      location.hash = '#/dashboard';
    } catch (err) {
      btnRestore();
      toast('⚠ ' + (err.message || 'Неуспешен вход'));
    }
    return;
  }

  // Без сървър: локални акаунти с истински пароли (пазени в този браузър)
  try {
    if (mode === 'register') {
      await LocalAuth.register(email, name, password);
      login(email, name);
      location.hash = '#/dashboard';
    } else {
      const v = await LocalAuth.verify(email, password);
      if (!v.ok) {
        btnRestore();
        toast(v.code === 'no-account'
          ? '⚠ Няма акаунт с този имейл — регистрирай се.'
          : '⚠ Грешна парола. Опитай пак или ползвай „Забравена парола“.');
        return;
      }
      LocalAuth.touch(email);
      login(email, v.acc.name);
      location.hash = '#/dashboard';
    }
  } catch (err) {
    btnRestore();
    toast('⚠ ' + (err.message || 'Грешка при входа'));
  }
}

/* След вход: изтегли покупките и прогреса от сървъра */
async function backendPostLogin() {
  try {
    const r = await apiFetch('/api/me/purchases');
    (r.data || []).forEach(pu => {
      if (!state.purchased.includes(pu.package_id)) state.purchased.push(pu.package_id);
    });
  } catch (e) { /* офлайн — локалните остават */ }

  try {
    const r = await apiFetch('/api/me/state');
    if (r.data && r.data.state) {
      const keepUser = state.user;
      const localPurchased = state.purchased.slice();
      state = { ...state, ...r.data.state };
      state.user = keepUser;
      // покупките: обединение (сървър + локални + вече слетите)
      if (!Array.isArray(state.purchased)) state.purchased = [];
      localPurchased.forEach(pid => { if (!state.purchased.includes(pid)) state.purchased.push(pid); });
    }
  } catch (e) { /* няма запазен прогрес — ок */ }

  saveState();
}

/* Прогресът се качва автоматично (debounce 4 сек след последната промяна) */
function scheduleStateSync() {
  if (PA_BACKEND !== true || !getJwt()) return;
  clearTimeout(window.__stateSyncT);
  window.__stateSyncT = setTimeout(() => {
    try {
      const snapshot = JSON.parse(JSON.stringify(state));
      delete snapshot.user;
      apiFetch('/api/me/state', {
        method: 'PUT',
        body: JSON.stringify({ state: snapshot, device_label: navigator.platform || 'browser' }),
      }).catch(() => {});
    } catch (e) { /* ignore */ }
  }, 4000);
}

function switchProfile(newId) {
  const cur = currentProfileId();
  if (cur === newId) return;
  // Запази текущия профил
  snapshotProfile(cur);
  const hasProfile = localStorage.getItem('pa_profile::' + newId) !== null;
  if (!hasProfile && cur === 'guest') {
    // Първо влизане на този акаунт: гост прогресът става негов (миграция).
    // Гост профилът се изпразва, за да не се прехвърли и на СЛЕДВАЩ акаунт.
    localStorage.setItem('pa_active_profile', newId);
    snapshotProfile(newId);
    localStorage.setItem('pa_profile::guest', '{}');
    state = JSON.parse(DEFAULT_STATE_JSON);
    loadState();
    return;
  }
  activateProfile(newId);
}

function saveState() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  // Ако има свързан backend — прогресът се качва и там (виж scheduleStateSync)
  if (typeof scheduleStateSync === 'function') scheduleStateSync();
}

export { PA_BACKEND, PA_BACKEND_URL, apiFetch, authSubmit, backendPostLogin, backendReady, getJwt, saveState, scheduleStateSync, setJwt, switchProfile };
