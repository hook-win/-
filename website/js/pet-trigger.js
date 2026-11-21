/* ============================================================
   月尺 · 桌宠触发器（网页 → Windows 桌面桌宠）
   只做一件事：在网页右下角放一个小挂件，点击通过
   qinghefloat:// 唤起「QinghePet.exe」，并把当前预算带过去。
   不改动网页原有的任何 DOM / 路由 / 浮窗逻辑。
   ============================================================ */
(function () {
  'use strict';
  if (window.__qhPetTriggerMounted) return;
  window.__qhPetTriggerMounted = true;

  var KEY = 'qhpet_trigger_v1';
  var state = { tipShown: false, hiddenUntil: 0 };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) state = Object.assign(state, JSON.parse(raw) || {});
  } catch (e) {}
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  var CSS = '' +
    '.qhpet-dock{position:fixed;right:22px;bottom:26px;z-index:2147483000;display:flex;align-items:center;' +
      'font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}' +
    '.qhpet-dock[hidden]{display:none!important}' +
    '.qhpet-btn{width:54px;height:54px;border-radius:50%;border:0;padding:0;position:relative;cursor:pointer;' +
      'background:linear-gradient(150deg,#ffffff,#e8f1ff);display:grid;place-items:center;' +
      'box-shadow:0 10px 24px -10px rgba(13,44,84,.16),0 2px 6px rgba(13,44,84,.08),inset 0 0 0 2px #c7ddf7;' +
      'transition:transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .2s;outline:none}' +
    '.qhpet-btn:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 16px 30px -12px rgba(13,44,84,.2),0 3px 8px rgba(13,44,84,.1),inset 0 0 0 2px #1a63d8}' +
    '.qhpet-btn:active{transform:translateY(-1px) scale(.99)}' +
    '.qhpet-btn:focus-visible{box-shadow:0 0 0 3px rgba(31,111,235,.42),0 10px 24px -10px rgba(13,44,84,.16)}' +
    '.qhpet-btn svg{width:38px;height:38px;display:block}' +
    '.qhpet-btn::after{content:"";position:absolute;inset:-5px;border-radius:50%;z-index:-1;' +
      'background:conic-gradient(from 140deg,rgba(31,111,235,.55),rgba(110,168,255,.45),rgba(31,111,235,.55));' +
      'filter:blur(7px);opacity:.55;transition:opacity .2s}' +
    '.qhpet-btn:hover::after{opacity:.9}' +
    '.qhpet-btn[data-loading="1"] svg{animation:qhpet-breathe .9s ease-in-out infinite}' +
    '@keyframes qhpet-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.09)}}' +
    '.qhpet-tip{position:absolute;right:66px;bottom:10px;padding:8px 12px;border-radius:10px;' +
      'background:rgba(255,255,255,.98);border:1px solid #d6e6f8;color:#0b2545;font-size:12px;line-height:1.5;white-space:nowrap;' +
      'box-shadow:0 12px 28px -14px rgba(13,44,84,.22);opacity:0;transform:translateX(8px);' +
      'pointer-events:none;transition:opacity .22s,transform .22s}' +
    '.qhpet-tip::after{content:"";position:absolute;right:-5px;bottom:16px;width:10px;height:10px;' +
      'background:rgba(255,255,255,.98);border-right:1px solid #d6e6f8;border-top:1px solid #d6e6f8;transform:rotate(45deg);border-radius:1px}' +
    '.qhpet-tip b{color:#0b4bb5;font-weight:800}' +
    '.qhpet-dock:hover .qhpet-tip,.qhpet-dock.tip-open .qhpet-tip{opacity:1;transform:none}' +
    '.qhpet-toast{position:fixed;right:22px;bottom:92px;z-index:2147483001;max-width:min(320px,80vw);' +
      'background:rgba(11,37,69,.96);color:#f2f7ff;font-size:12px;line-height:1.6;padding:10px 14px;' +
      'border-radius:12px;box-shadow:0 18px 40px -18px rgba(13,44,84,.3),0 0 24px -10px rgba(31,111,235,.28);opacity:0;transform:translateY(8px);' +
      'transition:opacity .22s,transform .22s;pointer-events:none;' +
      'font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}' +
    '.qhpet-toast.show{opacity:1;transform:none}' +
    '@media(max-width:920px){.qhpet-dock{right:16px;bottom:92px}.qhpet-toast{right:16px;bottom:156px}}' +
    '@media(prefers-reduced-motion:reduce){.qhpet-btn,.qhpet-tip,.qhpet-toast{transition:none}}';

  function injectCSS() {
    if (document.getElementById('qhpet-style')) return;
    var st = document.createElement('style');
    st.id = 'qhpet-style';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  var SVG = '' +
    '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="qhpetRing" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#1a63d8"/><stop offset="1" stop-color="#6ea8ff"/>' +
        '</linearGradient>' +
        '<linearGradient id="qhpetFace" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#ffd3dd"/><stop offset="1" stop-color="#f9adc2"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<circle cx="24" cy="24" r="21.5" fill="url(#qhpetRing)"/>' +
      '<circle cx="24" cy="24" r="18.5" fill="#eef5ff"/>' +
      '<ellipse cx="15.5" cy="15.5" rx="5.4" ry="4.6" fill="#f49db6" transform="rotate(-24 15.5 15.5)"/>' +
      '<ellipse cx="32.5" cy="15.5" rx="5.4" ry="4.6" fill="#f49db6" transform="rotate(24 32.5 15.5)"/>' +
      '<ellipse cx="24" cy="26" rx="14" ry="12" fill="url(#qhpetFace)"/>' +
      '<ellipse cx="24" cy="29" rx="6.4" ry="4.4" fill="#f28fa9"/>' +
      '<circle cx="21.8" cy="29" r="0.9" fill="#b34e6a"/>' +
      '<circle cx="26.2" cy="29" r="0.9" fill="#b34e6a"/>' +
      '<circle cx="18.4" cy="22.6" r="1.5" fill="#4a2233"/>' +
      '<circle cx="29.6" cy="22.6" r="1.5" fill="#4a2233"/>' +
      '<circle cx="18.9" cy="22.1" r="0.45" fill="#fff"/>' +
      '<circle cx="30.1" cy="22.1" r="0.45" fill="#fff"/>' +
      '<ellipse cx="14.8" cy="27" rx="2.4" ry="1.3" fill="#f27f9c" opacity=".55"/>' +
      '<ellipse cx="33.2" cy="27" rx="2.4" ry="1.3" fill="#f27f9c" opacity=".55"/>' +
      '<path d="M21 34.2c1.8 1.6 4.2 1.6 6 0" stroke="#b34e6a" stroke-width="1.3" fill="none" stroke-linecap="round"/>' +
    '</svg>';

  var dock, btn, tip, toastEl;

  function build() {
    injectCSS();
    dock = document.createElement('div');
    dock.className = 'qhpet-dock';
    dock.innerHTML =
      '<div class="qhpet-tip">打开 <b>桌面桌宠</b>，浮在所有窗口之上</div>' +
      '<button class="qhpet-btn" type="button" aria-label="打开桌面桌宠" title="打开桌面桌宠">' + SVG + '</button>';
    document.body.appendChild(dock);
    btn = dock.querySelector('.qhpet-btn');
    tip = dock.querySelector('.qhpet-tip');
    btn.addEventListener('click', launch);
  }

  function snapshot() {
    try {
      if (typeof S !== 'undefined' && S) {
        var budget = Number(S.budget) || 0;
        var spent = (typeof monthSpent === 'function') ? Number(monthSpent()) : 0;
        var days = (typeof daysLeft === 'function') ? Number(daysLeft()) : 0;
        return { budget: budget, spent: isFinite(spent) ? spent : 0, days: days };
      }
    } catch (e) {}
    return { budget: 0, spent: 0, days: 0 };
  }

  function protocolUrl() {
    var d = snapshot();
    return 'qinghefloat://show?budget=' + Math.round(d.budget) +
      '&spent=' + d.spent.toFixed(2) +
      (d.days ? '&days=' + d.days : '') +
      '&website=' + encodeURIComponent(location.href) +
      '&source=' + encodeURIComponent(location.href);
  }

  var toastTimer = null;
  function toast(msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'qhpet-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 3600);
  }

  function launch() {
    var d = snapshot();
    var url = protocolUrl();
    btn.dataset.loading = '1';

    try {
      var a = document.createElement('a');
      a.href = url;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 900);
    } catch (e) {
      try { window.location.href = url; } catch (e2) {}
    }

    if (!d.budget) {
      toast('桌宠已唤起。网页里还没有设置月预算，桌面会先显示默认值。');
    } else {
      toast('正在唤起桌面桌宠 · 本月还剩 ¥' + Math.max(0, Math.round(d.budget - d.spent)) + '');
    }

    setTimeout(function () { btn.dataset.loading = ''; }, 1400);
    setTimeout(function () {
      toast('如果桌面没有出现桌宠，请先双击网站目录里的「QinghePet.exe」运行一次。', 5200);
    }, 3200);
  }

  function mount() {
    if (document.getElementById('qhpet-style')) return;
    build();
    var now = Date.now();
    if (state.hiddenUntil && now < state.hiddenUntil) {
      dock.hidden = true;
      setTimeout(function () { dock.hidden = false; }, state.hiddenUntil - now);
    }
    // 首次进入时轻轻提示一次，不打断操作
    if (!state.tipShown) {
      setTimeout(function () {
        if (dock.hidden) return;
        dock.classList.add('tip-open');
        setTimeout(function () { dock.classList.remove('tip-open'); }, 5200);
        state.tipShown = true;
        save();
      }, 2800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
