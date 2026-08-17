/* Автоматично добавени връзки при разделянето на монолита. */
import { $ } from './10-helpers.js';

/* =============================================================================
   CONTENT PROTECTION — watermark + anti-copy on protected blocks
   ============================================================================= */
function setupContentProtection() {
  // Build copy shield element if missing
  if (!$('#copyShield')) {
    const sh = document.createElement('div');
    sh.id = 'copyShield';
    sh.className = 'copy-shield';
    sh.innerHTML = '<h4>Защитено съдържание</h4><p>Този учебен материал е достъпен само в платформата. Копирането и разпространението не са разрешени.</p>';
    document.body.appendChild(sh);
  }
  // Block copy / context menu / dragstart on .protected-content
  ['copy', 'cut', 'contextmenu', 'dragstart'].forEach(ev => {
    document.addEventListener(ev, function(e) {
      const target = e.target;
      if (target && target.closest && target.closest('.protected-content')) {
        e.preventDefault();
        showCopyShield();
      }
    });
  });
  // Detect Ctrl+S / Ctrl+P on protected pages (just shield message)
  document.addEventListener('keydown', function(e) {
    const onProtected = $('.protected-content');
    if (!onProtected) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'a')) {
      e.preventDefault();
      showCopyShield();
    }
  });
}
function showCopyShield() {
  const sh = $('#copyShield');
  if (!sh) return;
  sh.classList.add('show');
  clearTimeout(showCopyShield._t);
  showCopyShield._t = setTimeout(() => sh.classList.remove('show'), 2400);
}

function watermarkSvg(text) {
  // Inline SVG watermark with user identifier (data URL)
  const t = (text || 'Law+').slice(0, 40);
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200' viewBox='0 0 320 200'><text x='160' y='100' text-anchor='middle' font-family='Inter, sans-serif' font-size='14' fill='" + (document.documentElement.getAttribute('data-theme') === 'dark' ? '#F5F1EA' : '#0F1B2D') + "' font-weight='500'>" + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text></svg>';
  return 'url(data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg).replace(/[()']/g, function(c){ return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }) + ')';
}

function userWatermarkText() {
  if (!state.user) return 'Law+';
  const id = state.user.email || state.user.name || '';
  return id + ' · ' + new Date().toISOString().slice(0, 10);
}

export { setupContentProtection, showCopyShield, userWatermarkText, watermarkSvg };
