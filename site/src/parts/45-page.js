/* Автоматично добавени връзки при разделянето на монолита. */
import { SUBJECTS } from './00-seed.js';
import { saveState } from './09-backend-integraciya.js';
import { $, escapeHtml, isLoggedIn, toast, updateNav } from './10-helpers.js';
import { todayStr } from './11-topic-progress-streak-theme.js';
import { Activity } from './14-data-service.js';
import { API } from './15-api.js';

/* =============================================================================
   PAGES — Settings (account, password, email, GDPR)
   ============================================================================= */
function renderSettings() {
  if (!isLoggedIn()) { location.hash = '#/login'; return; }
  const u = state.user;
  const prefs = state.notifPrefs || {};
  const purchases = state.purchased || [];
  $('#app').innerHTML = `
    <section class="page-head"><div class="container">
      <a href="#/dashboard" style="font-size:13px;color:var(--text-3);text-decoration:none;">← Табло</a>
      <h1 style="margin-top:10px;">Настройки на акаунта</h1>
      <p>Управлявай профила, паролата, известията и личните си данни.</p>
    </div></section>

    <section style="padding-bottom:80px;"><div class="container" style="max-width:780px;">

      <div class="settings-card">
        <h3>Профил</h3>
        <div class="settings-field">
          <label>Име</label>
          <div class="settings-row">
            <input id="setName" type="text" value="${escapeHtml(u.name || '')}">
            <button class="btn btn-outline" onclick="window.__setSaveName()">Запази</button>
          </div>
        </div>
        <div class="settings-field">
          <label>Email <span style="color:${u.emailVerified ? '#15803d' : '#c2410c'};font-size:11px;margin-left:8px;">${u.emailVerified ? '✓ потвърден' : '⚠ непотвърден'}</span></label>
          <div class="settings-row">
            <input id="setEmail" type="email" value="${escapeHtml(u.email || '')}">
            <button class="btn btn-outline" onclick="window.__setSaveEmail()">Промени</button>
          </div>
          <div class="settings-hint">При смяна на email ще ти изпратим линк за потвърждение на новия адрес.</div>
        </div>
      </div>

      <div class="settings-card">
        <h3>Парола</h3>
        <div style="background:#eff6ff;padding:10px 14px;border-radius:6px;font-size:12px;color:#0959a5;margin-bottom:14px;">
          ℹ <strong>Демо режим:</strong> платформата още няма свързан backend, така че текущата парола не се проверява. След launch (Supabase auth) ще е задължителна.
        </div>
        <div class="settings-field">
          <label>Текуща парола <span style="text-transform:none;letter-spacing:0;color:var(--text-3);font-weight:400;">(опционално в демо)</span></label>
          <input id="setPwOld" type="password" autocomplete="current-password" placeholder="Остави празно в демо режим">
        </div>
        <div class="settings-field">
          <label>Нова парола (минимум 8 символа)</label>
          <input id="setPwNew" type="password" autocomplete="new-password">
        </div>
        <div class="settings-field">
          <label>Повтори новата парола</label>
          <input id="setPwRep" type="password" autocomplete="new-password">
        </div>
        <button class="btn btn-gold" onclick="window.__setChangePw()">Промени паролата</button>
      </div>

      <div class="settings-card">
        <h3>Известия</h3>
        ${[
          {k:'dailyReminder', label:'Дневно напомняне за SRS повторение', sub:'Един имейл сутрин, ако имаш карти за повторение.'},
          {k:'weeklyReport', label:'Седмичен отчет за прогреса', sub:'Колко си учил миналата седмица, какви теми ти вървят.'},
          {k:'newContent', label:'Известия за ново съдържание', sub:'Когато добавя нови теми, казуси или функции.'},
          {k:'marketing', label:'Маркетинг и оферти', sub:'Промоции, специални пакети, отстъпки.'},
        ].map(p => `
          <label class="settings-toggle">
            <input type="checkbox" ${prefs[p.k] ? 'checked' : ''} onchange="window.__setPref('${p.k}', this.checked)">
            <span class="settings-toggle-label">${p.label}</span>
            <span class="settings-toggle-sub">${p.sub}</span>
          </label>`).join('')}
      </div>

      <div class="settings-card">
        <h3>Закупени пакети</h3>
        ${purchases.length === 0
          ? '<p style="color:var(--text-3);font-size:13px;">Все още нямаш закупени пакети. <a href="#/pricing" style="color:var(--gold);">Виж пакетите →</a></p>'
          : `<table class="adm-table" style="margin-top:8px;"><thead><tr><th>Пакет</th><th>Купен на</th><th>Достъп</th></tr></thead><tbody>
            ${purchases.map(pid => {
              const s = SUBJECTS.find(x => x.id === pid);
              return `<tr><td>${escapeHtml(s ? s.name : pid)}</td><td>${new Date(state.userCreatedAt || Date.now()).toLocaleDateString('bg-BG')}</td><td><span style="color:#15803d;">✓ активен</span></td></tr>`;
            }).join('')}</tbody></table>`}
      </div>

      <div class="settings-card">
        <h3>Личните ти данни (GDPR)</h3>
        <p style="font-size:13px;color:var(--text-2);line-height:1.6;margin-bottom:14px;">
          Имаш право да изтеглиш всичките си данни (прогрес, SRS, история, плащания) или да поискаш изтриване на акаунта си. Това са правата ти по член 15 и 17 от GDPR.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-outline" onclick="window.__setExportData()">📥 Свали моите данни</button>
          <button class="btn btn-outline" onclick="location.hash='#/privacy'">📄 Прочети Privacy Policy</button>
        </div>
      </div>

      <div class="settings-card settings-danger">
        <h3>Опасна зона</h3>
        <p style="font-size:13px;color:var(--text-2);line-height:1.6;margin-bottom:14px;">
          Изтриването на акаунта започва 30-дневен grace период. През този период можеш да възстановиш, като влезнеш отново. След 30 дни данните се изтриват необратимо.
        </p>
        <button class="btn btn-outline" style="color:#b91c1c;border-color:#fecaca;" onclick="window.__setDeleteAccount()">🗑 Изтрий акаунта ми</button>
      </div>

    </div></section>`;
}
window.__setSaveName = async function() {
  const name = document.getElementById('setName').value.trim();
  try { await API.updateProfile({ name }); toast('Името е запазено', true); updateNav(); } catch(e){ toast(e.message); }
};
window.__setSaveEmail = async function() {
  const newEmail = document.getElementById('setEmail').value.trim();
  if (!confirm('При смяна на email ще трябва да потвърдиш новия адрес. Продължи?')) return;
  try { await API.changeEmail({ newEmail }); toast('Email-ът е променен. Провери пощата си за линк за потвърждение.', true); renderSettings(); } catch(e){ toast(e.message); }
};
window.__setChangePw = async function() {
  const oldP = document.getElementById('setPwOld').value;
  const newP = document.getElementById('setPwNew').value;
  const rep = document.getElementById('setPwRep').value;
  if (newP !== rep) { toast('Новите пароли не съвпадат'); return; }
  try { await API.changePassword({ currentPassword: oldP, newPassword: newP }); toast('Паролата е променена', true);
    document.getElementById('setPwOld').value = ''; document.getElementById('setPwNew').value = ''; document.getElementById('setPwRep').value = '';
  } catch(e){ toast(e.message); }
};
window.__setPref = function(k, v) {
  if (!state.notifPrefs) state.notifPrefs = {};
  state.notifPrefs[k] = v; saveState();
  Activity.log('settings.pref-change', null, { k, v });
};
window.__setExportData = async function() {
  const data = await API.exportMyData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'my-pravo-academy-data-' + todayStr() + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Данните се свалят', true);
};
window.__setDeleteAccount = async function() {
  if (!confirm('Сигурен ли си, че искаш да изтриеш акаунта си?\\n\\nЩе започне 30-дневен grace период. Прогресът, SRS-ът, плащанията — всичко ще се изгуби след това.')) return;
  if (!confirm('Наистина сигурен? Това е необратимо след 30 дни.')) return;
  await API.deleteAccount();
  toast('Акаунтът е насрочен за изтриване', true);
  setTimeout(() => { location.hash = '#/'; location.reload(); }, 1500);
};

export { renderSettings };
