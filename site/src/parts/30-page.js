/* Автоматично добавени връзки при разделянето на монолита. */
import { $ } from './10-helpers.js';

/* =============================================================================
   PAGES — Login / Register
   ============================================================================= */
function renderLogin() {
  $('#app').innerHTML = `
    <section class="auth">
      <div class="container">
        <div class="auth-card">
          <h2>Вход в акаунта</h2>
          <p class="auth-sub">Продължи там, където спря.</p>
          <form onsubmit="event.preventDefault(); authSubmit(this, 'login');">
            <div class="field">
              <label>Имейл</label>
              <input class="input" name="email" type="email" required placeholder="ivan@example.com" value="demo@pravo-academy.bg">
            </div>
            <div class="field">
              <label>Парола</label>
              <input class="input" type="password" required placeholder="••••••••" value="Demo1234!">
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:18px;">
              <label style="display:flex;align-items:center;gap:6px;color:var(--text-2);"><input type="checkbox"> Запомни ме</label>
              <a href="#/forgot-password" style="color:var(--gold-3);">Забравена парола?</a>
            </div>
            <button class="btn btn-gold btn-block btn-lg">Вход</button>
          </form>
          <div class="auth-foot">
            Нямаш акаунт? <a href="#/register">Регистрирай се</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderRegister() {
  $('#app').innerHTML = `
    <section class="auth">
      <div class="container">
        <div class="auth-card">
          <h2>Създай акаунт</h2>
          <p class="auth-sub">Получи 5 безплатни карти от всяка дисциплина.</p>
          <form onsubmit="event.preventDefault(); authSubmit(this, 'register');">
            <div class="field">
              <label>Име</label>
              <input class="input" name="name" required placeholder="Иван Иванов">
            </div>
            <div class="field">
              <label>Имейл</label>
              <input class="input" name="email" type="email" required placeholder="ivan@example.com">
            </div>
            <div class="field">
              <label>Университет</label>
              <select class="select">
                <option>СУ "Св. Климент Охридски"</option>
                <option>ПУ "Паисий Хилендарски"</option>
                <option>НБУ</option>
                <option>УНСС</option>
                <option>Друг</option>
              </select>
            </div>
            <div class="field">
              <label>Парола</label>
              <input class="input" type="password" required placeholder="••••••••">
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-2);margin-bottom:18px;">
              <input type="checkbox" required> Прочетох и приемам <a href="#/terms" style="color:var(--gold-3);">Общите условия</a> и се запознах с <a href="#/privacy" style="color:var(--gold-3);">Политиката за поверителност</a></label>
            <button class="btn btn-gold btn-block btn-lg">Създай акаунт</button>
          </form>
          <div class="auth-foot">
            Имаш акаунт? <a href="#/login">Вход</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

export { renderLogin, renderRegister };
