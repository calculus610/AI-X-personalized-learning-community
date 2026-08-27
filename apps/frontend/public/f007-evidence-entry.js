/**
 * AI Evidence Lab — Entry Point Injector
 * Injects a floating entry card into the personalized-secure main platform.
 * Pattern matches f007-agent-shell.js injection style.
 *
 * Deploy: Nginx sub_filter injects this script into platform pages.
 */
(function() {
  'use strict';

  // Prevent duplicate injection
  if (document.getElementById('f007-evidence-entry')) return;

  // ========== Styles ==========
  var style = document.createElement('style');
  style.id = 'f007-evidence-entry-style';
  style.textContent = ''
    + '.f007-evidence-entry{position:fixed;z-index:890;left:26px;bottom:24px;'
    + 'display:flex;align-items:center;gap:10px;padding:10px 18px 10px 14px;'
    + 'border-radius:999px;border:1px solid rgb(101 231 242 / 28%);'
    + 'background:rgb(12 17 31 / 82%);backdrop-filter:blur(18px);'
    + '-webkit-backdrop-filter:blur(18px);'
    + 'box-shadow:0 8px 32px rgb(0 0 0 / 28%);'
    + 'color:#909bb9;font-family:"Inter Variable",Inter,"HarmonyOS Sans SC",sans-serif;'
    + 'font-size:12px;cursor:pointer;transition:all .2s;text-decoration:none;'
    + 'user-select:none}'
    + '.f007-evidence-entry:hover{border-color:#c7ff68;color:#c7ff68;'
    + 'box-shadow:0 0 24px rgb(199 255 104 / 12%),0 8px 32px rgb(0 0 0 / 28%);'
    + 'transform:translateY(-2px)}'
    + '.f007-evidence-entry svg{width:16px;height:16px;flex-shrink:0}'
    + '.f007-evidence-label{font-weight:600;letter-spacing:.02em}'
    + '.f007-evidence-badge{font-size:10px;padding:1px 6px;border-radius:999px;'
    + 'background:rgb(199 255 104 / 12%);color:#c7ff68;font-weight:600}'
    + '@media(max-width:768px){.f007-evidence-entry{left:12px;bottom:12px;padding:8px 14px 8px 10px}}';
  document.head.appendChild(style);

  // ========== Entry Element ==========
  var entry = document.createElement('a');
  entry.id = 'f007-evidence-entry';
  entry.className = 'f007-evidence-entry';
  entry.href = '/ai-evidence-lab/';
  entry.target = '_blank';
  entry.title = 'AI Algorithm Evidence Lab — 23 peer-reviewed papers, 5 algorithm modules';

  // Icon (scroll for evidence/theory/literature)
  entry.innerHTML = ''
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M8 21h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8v18z"/>'
    + '<path d="M4 3v18"/><path d="M4 7h2"/><path d="M4 11h2"/><path d="M4 15h2"/>'
    + '<line x1="12" y1="7" x2="18" y2="7"/><line x1="12" y1="11" x2="18" y2="11"/><line x1="12" y1="15" x2="16" y2="15"/>'
    + '</svg>'
    + '<span class="f007-evidence-label">算法证据附录</span>'
    + '<span class="f007-evidence-badge">23篇文献</span>';

  document.body.appendChild(entry);

  console.log('[Evidence Lab] Entry point injected. Click to open /ai-evidence-lab/');
})();
