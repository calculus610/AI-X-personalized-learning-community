/**
 * f007-evidence-buttons.js — 独立脚本，不修改 platform-enhance.js
 * 在学习导师工作台中追加三个证据 ? 按钮：
 *   学习画像 → 证据链
 *   导师对话 → 数字人
 *   任务提醒 → Quiz机制
 */
(function () {
  'use strict';

  if (window.__EVIDENCE_BUTTONS__) return;
  window.__EVIDENCE_BUTTONS__ = true;

  var URLS = {
    evidence: '/ai-evidence-lab/pages/05-evidence-chain.html',
    digital: '/ai-evidence-lab/pages/01-digital-human.html',
    quiz: '/ai-evidence-lab/pages/02-quiz.html'
  };

  var TITLES = {
    evidence: '查看学习画像证据附录',
    digital: '查看数字人算法与理论依据',
    quiz: '查看Quiz评估机制附录'
  };

  // Reuse the iframe modal created by f007-evidence-nav.js
  function openIframe(url, title) {
    var modal = document.getElementById('evq-modal');
    var iframe = document.getElementById('evq-mi');
    var titleEl = document.getElementById('evq-mt');
    if (!modal || !iframe) {
      // Fallback: open in new tab if modal not ready
      window.open(url, '_blank');
      return;
    }
    if (titleEl) titleEl.textContent = title || '';
    iframe.src = url;
    modal.classList.add('evq-modal--on');
    document.body.style.overflow = 'hidden';
  }

  function makeBtn(url, title, color) {
    var s = document.createElement('span');
    s.textContent = '?';
    s.title = title;
    s.style.cssText =
      'width:18px;height:18px;border-radius:50%;' +
      'border:1px solid ' + (color || 'rgba(101,231,242,.3)') + ';' +
      'background:rgba(12,17,31,.7);color:' + (color || '#65e7f2') + ';' +
      'font-size:11px;font-weight:700;cursor:pointer;' +
      'display:inline-flex;align-items:center;justify-content:center;' +
      'line-height:1;flex-shrink:0;margin-left:6px;' +
      'transition:all .15s';
    s.onmouseenter = function () {
      s.style.borderColor = '#c7ff68';
      s.style.color = '#c7ff68';
    };
    s.onmouseleave = function () {
      s.style.borderColor = color || 'rgba(101,231,242,.3)';
      s.style.color = color || '#65e7f2';
    };
    s.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      openIframe(url, title);
    });
    return s;
  }

  function injectButtons() {
    var panel = document.getElementById('__aix_teacher_panel');
    if (!panel) return;

    // 1. 学习画像标题 → 证据 ?
    if (!document.getElementById('__evbtn_evidence')) {
      var body = document.getElementById('__aix_teacher_body');
      if (body) {
        // Find the 学习画像 section header
        var allDivs = body.querySelectorAll('div');
        for (var i = 0; i < allDivs.length; i++) {
          var t = (allDivs[i].textContent || '').trim();
          var style = allDivs[i].getAttribute('style') || '';
          if (t === '学习画像' && style.indexOf('uppercase') !== -1) {
            var btn = makeBtn(URLS.evidence, TITLES.evidence, '#65e7f2');
            btn.id = '__evbtn_evidence';
            // Wrap in flex container
            var wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;gap:4px';
            allDivs[i].parentNode.insertBefore(wrap, allDivs[i]);
            wrap.appendChild(allDivs[i]);
            wrap.appendChild(btn);
            break;
          }
        }
      }
    }

    // 2. 导师对话标题 → 数字人 ?
    if (!document.getElementById('__evbtn_digital')) {
      var body = document.getElementById('__aix_teacher_body');
      if (body) {
        var allDivs = body.querySelectorAll('div');
        for (var j = 0; j < allDivs.length; j++) {
          var t2 = (allDivs[j].textContent || '').trim();
          var style2 = allDivs[j].getAttribute('style') || '';
          if (t2 === '导师对话' && style2.indexOf('uppercase') !== -1) {
            var btn2 = makeBtn(URLS.digital, TITLES.digital, '#65e7f2');
            btn2.id = '__evbtn_digital';
            var wrap2 = document.createElement('div');
            wrap2.style.cssText = 'display:flex;align-items:center;gap:4px';
            allDivs[j].parentNode.insertBefore(wrap2, allDivs[j]);
            wrap2.appendChild(allDivs[j]);
            wrap2.appendChild(btn2);
            break;
          }
        }
      }
    }

    // 3. 任务提醒 → Quiz ?
    if (!document.getElementById('__evbtn_quiz')) {
      var body = document.getElementById('__aix_teacher_body');
      if (body) {
        var allSpans = body.querySelectorAll('span');
        for (var k = 0; k < allSpans.length; k++) {
          if (allSpans[k].textContent.trim() === '任务提醒') {
            var btn3 = makeBtn(URLS.quiz, TITLES.quiz, '#c7ff4f');
            btn3.id = '__evbtn_quiz';
            btn3.style.width = '16px';
            btn3.style.height = '16px';
            btn3.style.fontSize = '10px';
            allSpans[k].parentNode.insertBefore(btn3, allSpans[k].nextSibling);
            break;
          }
        }
      }
    }
  }

  // Watch for the teacher panel to appear
  var timer = null;
  var obs = new MutationObserver(function () {
    if (timer) return;
    timer = setTimeout(function () {
      timer = null;
      injectButtons();
    }, 500);
  });
  obs.observe(document.body, { childList: true, subtree: true });

  // Also try on load
  if (document.readyState === 'complete') {
    setTimeout(injectButtons, 1500);
  } else {
    window.addEventListener('load', function () {
      setTimeout(injectButtons, 1500);
    });
  }

  // Retry a few times for late-rendering panels
  var retries = 0;
  var retryInterval = setInterval(function () {
    retries++;
    injectButtons();
    if (retries > 10) clearInterval(retryInterval);
  }, 2000);

})();
