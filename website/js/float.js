'use strict';
/* ============================================================
   生活费浮窗 · v2.1 适配版
   - 读取网站 app.js 的 S / monthRecords / monthSpent / pctNow 等数据
   - 显示本月剩余、预算进度、近期流水
   - 小额超支：暖色温馨提示；大额支出 / 大额超支：红色警示
   - 双击浮窗（或点右下角「网页版」）打开 #/records 消费记录页
   - 与实时流水（SSE）联动：记录一入账，浮窗自动刷新
   ============================================================ */
(function () {
  if (document.getElementById('qhFloat')) return;
  if (typeof S === 'undefined' || typeof monthRecords !== 'function' || typeof monthSpent !== 'function') return;

  var ICON = {
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6.2A10.5 10.5 0 0 1 12 6c6.5 0 10 6 10 6a17.2 17.2 0 0 1-3.2 3.8"/><path d="M6.1 6.5A17.6 17.6 0 0 0 2 12s3.5 6 10 6c1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v6h-6"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z"/><path d="M9 8h6M9 12h6"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h16M4 16h16"/><path d="M8 4v3M16 4v3"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
  };

  var root = document.createElement('div');
  root.className = 'qh-float';
  root.id = 'qhFloat';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', '生活费浮窗（双击打开网页版流水）');
  root.innerHTML =
    '<button class="qhf-x" type="button" title="关闭浮窗" aria-label="关闭浮窗">×</button>' +
    '<div class="qhf-head">' +
      '<span class="qhf-mark" aria-hidden="true"><svg><use href="#i-jar"/></svg></span>' +
      '<div class="qhf-title">' +
        '<span class="qhf-kicker">月尺 · 生活费浮窗</span>' +
        '<span class="qhf-lab" id="qhfLab">本月还剩</span>' +
        '<span class="qhf-num num" id="qhfNum">--</span>' +
      '</div>' +
      '<span class="qhf-mini-days" id="qhfMiniDays">· -- 天</span>' +
      '<div class="qhf-ring" aria-hidden="true">' +
        '<svg viewBox="0 0 48 48">' +
          '<defs><linearGradient id="qhfRingGrad" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#1a63d8"/><stop offset="100%" stop-color="#6ea8ff"/>' +
          '</linearGradient></defs>' +
          '<circle cx="24" cy="24" r="19" fill="none" stroke="#e3edf9" stroke-width="5"/>' +
          '<circle id="qhfArc" cx="24" cy="24" r="19" fill="none" stroke="url(#qhfRingGrad)" stroke-width="5" ' +
            'stroke-linecap="round" stroke-dasharray="119.4" stroke-dashoffset="119.4" transform="rotate(-90 24 24)"/>' +
        '</svg>' +
        '<span id="qhfPct">--</span>' +
      '</div>' +
    '</div>' +
    '<div class="qhf-bar"><i id="qhfBar"></i></div>' +
    '<div class="qhf-meta"><span id="qhfMeta">--</span><span class="qhf-sync" id="qhfSync">已同步</span></div>' +
    '<div class="qhf-alert" id="qhfAlert" data-level="warn" hidden>' +
      '<span class="qhf-alert-ico" aria-hidden="true">!</span>' +
      '<div class="qhf-txt">' +
        '<span class="qhf-k" id="qhfAlertK">温馨提示</span>' +
        '<span id="qhfAlertTxt"></span>' +
        '<span class="qhf-sub" id="qhfAlertSub"></span>' +
      '</div>' +
      '<button class="qhf-more" id="qhfMore" type="button">看流水</button>' +
    '</div>' +
    '<div class="qhf-flow-head">' +
      '<b>近期流水</b>' +
      '<button class="qhf-pending" id="qhfPending" type="button" hidden></button>' +
      '<span class="qhf-count" id="qhfCount"></span>' +
    '</div>' +
    '<div class="qhf-flow" id="qhfFlow"></div>' +
    '<div class="qhf-detail" id="qhfDetail"></div>' +
    '<div class="qhf-foot">' +
      '<span class="qhf-hint"><b>双击卡片</b>打开网页版流水</span>' +
      '<div class="qhf-tools">' +
        '<button type="button" data-act="mask" title="隐藏金额" aria-label="隐藏金额">' + ICON.eye + '</button>' +
        '<button type="button" data-act="refresh" title="刷新数据" aria-label="刷新数据">' + ICON.refresh + '</button>' +
        '<button type="button" data-act="expand" title="展开明细" aria-label="展开明细">' + ICON.chevron + '</button>' +
        '<button type="button" data-act="open" title="打开网页版流水" aria-label="打开网页版流水">' + ICON.receipt + '</button>' +
        '<button type="button" data-act="compact" title="收起为胶囊" aria-label="收起为胶囊">' + ICON.layers + '</button>' +
      '</div>' +
    '</div>';

  var restore = document.createElement('button');
  restore.className = 'qhf-restore';
  restore.id = 'qhfRestore';
  restore.type = 'button';
  restore.title = '打开生活费浮窗';
  restore.setAttribute('aria-label', '打开生活费浮窗');
  restore.innerHTML = '<svg><use href="#i-jar"/></svg>';
  restore.hidden = true;

  document.body.appendChild(root);
  document.body.appendChild(restore);

  var el = function (id) { return document.getElementById(id); };
  var numEl = el('qhfNum');
  var labEl = el('qhfLab');
  var pctEl = el('qhfPct');
  var arcEl = el('qhfArc');
  var barEl = el('qhfBar');
  var metaEl = el('qhfMeta');
  var syncEl = el('qhfSync');
  var alertEl = el('qhfAlert');
  var alertKEl = el('qhfAlertK');
  var alertTxtEl = el('qhfAlertTxt');
  var alertSubEl = el('qhfAlertSub');
  var moreEl = el('qhfMore');
  var flowEl = el('qhfFlow');
  var countEl = el('qhfCount');
  var pendingEl = el('qhfPending');
  var detailEl = el('qhfDetail');
  var miniDaysEl = el('qhfMiniDays');

  var masked = false;
  var expanded = false;
  var lastKey = '';
  var tapTimer = 0;
  var drag = false;
  var moved = false;
  var suppressClick = false;
  var sx = 0, sy = 0, ox = 0, oy = 0;

  /* ---------- helpers ---------- */
  function fmtMoney(n) {
    n = Number(n) || 0;
    var abs = Math.abs(n);
    var r = Math.round(abs * 100) / 100;
    var s = r % 1 === 0
      ? r.toLocaleString('zh-CN')
      : r.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    return (n < 0 ? '−¥' : '¥') + s;
  }
  function moneyHtml(n) {
    return masked ? '¥•••' : fmtMoney(n);
  }
  function whenText(r) {
    if (!r || !r.date) return '';
    var day;
    if (typeof today === 'function' && r.date === today()) day = '今天';
    else if (typeof dstr === 'function' && r.date === dstr(1)) day = '昨天';
    else day = r.date.slice(5);
    return day + (r.time ? ' ' + r.time : '');
  }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function classifiedRecords() {
    if (!S || !Array.isArray(S.records)) return [];
    return S.records.filter(function (r) { return r && r.confirmed && r.cat; });
  }
  function flowRecords() {
    return classifiedRecords().slice().sort(function (a, b) {
      var ka = (a.date || '') + ' ' + (a.time || '');
      var kb = (b.date || '') + ' ' + (b.time || '');
      return kb.localeCompare(ka);
    });
  }
  function monthList() {
    return monthRecords().slice().sort(function (a, b) {
      var ka = (a.date || '') + ' ' + (a.time || '');
      var kb = (b.date || '') + ' ' + (b.time || '');
      return kb.localeCompare(ka);
    });
  }
  function budgetValue() {
    return Number(S && S.budget) || 0;
  }
  function bigThreshold() {
    return Math.max(200, budgetValue() * 0.12);
  }
  function smallLimit() {
    return Math.max(100, budgetValue() * 0.05);
  }
  function pendingCount() {
    var n = 0;
    if (typeof pendingMid === 'function') n += pendingMid().length;
    if (typeof poolLow === 'function') n += poolLow().length;
    return n;
  }
  function statusColor(pct) {
    if (pct > 100) return 'var(--rose)';
    if (pct >= 80) return 'var(--amber)';
    return 'var(--brand)';
  }

  /* ---------- popup page ---------- */
  function openRecordsPage() {
    var base = location.href.split('#')[0].split('?')[0];
    var url = base + '#/records';
    var win = null;
    try {
      win = window.open(url, '_blank',
        'width=1180,height=860,left=' + Math.max(20, Math.round((screen.availWidth - 1180) / 2)) +
        ',top=' + Math.max(20, Math.round((screen.availHeight - 860) / 2)));
    } catch (err) { win = null; }
    if (!win) {
      location.hash = '#/records';
      if (typeof toast === 'function') toast('浏览器拦住了弹窗，已在当前页打开消费记录');
    }
  }

  /* ---------- alert ---------- */
  function computeAlert(budget, left, pct, big, bigSum) {
    var over = Math.max(0, -left);
    if (!budget) {
      return {
        level: 'warn', k: '先设预算',
        txt: '还没有设置本月生活费。',
        sub: '设好之后，才能算出剩余和日均。',
        more: '去设置', act: 'budget'
      };
    }
    if (over > 0 && over <= smallLimit()) {
      return {
        level: 'warn', k: '温馨提示',
        txt: '这个月只超了 <b>' + fmtMoney(over) + '</b>，真的只是一点点。',
        sub: '缓一缓就回来了：接下来 ' + daysLeft() + ' 天每天少花 ' +
          fmtMoney(over / Math.max(1, daysLeft())) + ' 就能拉平。' +
          (big.length ? ' 另有 ' + big.length + ' 笔大额支出已标红。' : ''),
        more: '看流水', act: 'flow'
      };
    }
    if (over > 0) {
      return {
        level: 'danger', k: '大额警示',
        txt: '本月已超支 <b>' + fmtMoney(over) + '</b>' +
          (big.length ? '，其中大额支出 ' + big.length + ' 笔共 ' + fmtMoney(bigSum) : '') + '。',
        sub: '建议先看标红的几笔，再决定要不要调整下个月的预算。',
        more: '看标红', act: 'flow'
      };
    }
    if (big.length) {
      return {
        level: 'danger', k: '大额提醒',
        txt: '本月有 <b>' + big.length + '</b> 笔大额支出，共 <b>' + fmtMoney(bigSum) + '</b>。',
        sub: '已在流水里标红；还没超支，但值得看一眼。',
        more: '看看哪笔', act: 'flow'
      };
    }
    if (pct >= 80) {
      return {
        level: 'warn', k: '预算提醒',
        txt: '预算已用 <b>' + Math.round(pct) + '%</b>，还剩 <b>' + daysLeft() + '</b> 天。',
        sub: '接下来每天可用约 ' + fmtMoney(Math.max(0, left) / Math.max(1, daysLeft())) + '，留意小额支出。',
        more: '看流水', act: 'flow'
      };
    }
    return null;
  }

  /* ---------- refresh ---------- */
  function refresh() {
    try {
      var budget = budgetValue();
      var spent = monthSpent();
      var left = budget - spent;
      var pct = budget ? spent / budget * 100 : 0;
      var days = Math.max(0, Number(daysLeft()) || 0);
      var daily = left / Math.max(1, days);
      var color = statusColor(pct);
      var big = budget ? monthRecords().filter(function (r) { return r.amount >= bigThreshold(); }) : [];
      var bigSum = big.reduce(function (s, r) { return s + r.amount; }, 0);

      labEl.textContent = budget ? (left < 0 ? '本月超支' : '本月还剩') : '本月还剩';
      numEl.textContent = budget ? (masked ? '¥••••' : fmtMoney(left)) : '--';
      miniDaysEl.textContent = '· ' + days + ' 天';

      var p = Math.max(0, Math.min(100, pct));
      arcEl.setAttribute('stroke-dashoffset', (119.4 * (1 - p / 100)).toFixed(1));
      arcEl.setAttribute('stroke', color);
      pctEl.textContent = budget ? Math.round(pct) + '%' : '--';
      pctEl.style.color = color;
      barEl.style.width = p + '%';
      root.style.setProperty('--qhf-bar', color);

      if (!budget) {
        metaEl.innerHTML = '还没设置月生活费';
      } else if (left < 0) {
        metaEl.innerHTML = '已超 <b>' + moneyHtml(-left) + '</b> · 剩 <b>' + days + '</b> 天';
      } else {
        metaEl.innerHTML = '还剩 <b>' + days + '</b> 天 · 日均 <b>' + moneyHtml(daily) + '</b>';
      }
      var isDemo = (typeof SIM_TIME !== 'undefined') && SIM_TIME != null;
      syncEl.textContent = isDemo ? '演示时间 ' + fmtDate(simNow()) : '已同步';
      syncEl.classList.toggle('demo', !!isDemo);

      /* alert */
      var a = computeAlert(budget, left, pct, big, bigSum);
      if (a) {
        alertEl.hidden = false;
        alertEl.dataset.level = a.level;
        alertKEl.textContent = a.k;
        alertTxtEl.innerHTML = a.txt;
        alertSubEl.textContent = a.sub;
        moreEl.textContent = a.more;
        moreEl.hidden = false;
        alertEl.dataset.act = a.act;
        alertEl.dataset.big = big.length;
      } else {
        alertEl.hidden = true;
      }

      /* flow */
      var all = flowRecords();
      var list = all.slice(0, 8);
      var pending = pendingCount();
      pendingEl.hidden = pending === 0;
      pendingEl.textContent = pending + ' 笔待确认';
      countEl.textContent = all.length ? '本月 ' + all.length + ' 笔' : '暂无记录';

      if (!list.length) {
        flowEl.innerHTML = '<div class="qhf-empty">' +
          (budget
            ? '还没有已定案的流水。<br>记一笔，或到「<a href="#/live">实时流水演示</a>」接入后，这里会自动出现。'
            : '还没有流水。<br>先到「<a href="#/home">首页</a>」设定生活费并记一笔吧。') +
          '</div>';
      } else {
        var limit = bigThreshold();
        flowEl.innerHTML = list.map(function (r) {
          var c = catOf(r.cat);
          var isBig = r.amount >= limit;
          return '<div class="qhf-row' + (isBig ? ' big' : '') + '" style="--c:' + c.color + '">' +
            '<span class="qhf-ico" aria-hidden="true"><svg><use href="#' + c.ico + '"/></svg></span>' +
            '<span class="qhf-main"><span class="qhf-name">' + escHtml(r.merchant) + '</span>' +
            '<span class="qhf-when">' + escHtml(whenText(r)) + ' · ' + c.name + '</span></span>' +
            '<span class="qhf-amt"><span class="qhf-val">' + moneyHtml(r.amount) + '</span><i class="qhf-bigtag">大额</i></span>' +
            '</div>';
        }).join('');
      }

      /* detail */
      var mlist = monthList();
      var totals = {};
      mlist.forEach(function (r) { totals[r.cat] = (totals[r.cat] || 0) + r.amount; });
      var grand = spent || 1;
      var catsHtml = CATEGORIES.map(function (c) {
        var v = totals[c.id] || 0;
        var share = v / grand * 100;
        return '<div class="qhf-cat" style="--c:' + c.color + '">' +
          '<span class="qhf-cat-ico"><svg><use href="#' + c.ico + '"/></svg></span>' +
          '<span class="qhf-cat-name">' + c.name + '</span>' +
          '<span class="qhf-track"><i style="width:' + share.toFixed(1) + '%;background:' + c.color + '"></i></span>' +
          '<span class="qhf-cat-amt">' + moneyHtml(v) + '</span>' +
          '</div>';
      }).join('');
      detailEl.innerHTML =
        '<div class="qhf-detail-inner">' +
          '<div class="qhf-stats">' +
            '<div class="qhf-stat"><span>本月已花</span><b>' + moneyHtml(spent) + '</b></div>' +
            '<div class="qhf-stat"><span>今日</span><b>' + moneyHtml(todaySum()) + '</b></div>' +
            '<div class="qhf-stat"><span>待确认</span><b>' + pending + ' 笔</b></div>' +
          '</div>' + catsHtml +
        '</div>';
    } catch (err) {
      /* 数据尚未就绪时静默等待下一次刷新 */
    }
  }

  /* ---------- interaction ---------- */
  function setMasked(on) {
    masked = on;
    var btn = root.querySelector('[data-act="mask"]');
    if (btn) {
      btn.classList.toggle('on', masked);
      btn.innerHTML = masked ? ICON.eyeOff : ICON.eye;
      btn.title = masked ? '显示金额' : '隐藏金额';
    }
    refresh();
  }

  function setExpanded(on) {
    expanded = on;
    root.classList.toggle('expanded', on);
    var btn = root.querySelector('[data-act="expand"]');
    if (btn) {
      btn.classList.toggle('on', on);
      btn.style.transform = on ? 'rotate(180deg)' : '';
    }
    keepInView();
  }

  function setCompact(on) {
    root.classList.toggle('compact', on);
    if (on) {
      root.style.left = '';
      root.style.top = '';
      root.style.right = '22px';
      root.style.bottom = '96px';
    }
    var btn = root.querySelector('[data-act="compact"]');
    if (btn) btn.title = on ? '展开浮窗' : '收起为胶囊';
    keepInView();
  }

  function hideFloat() {
    root.classList.add('hidden');
    restore.hidden = false;
  }
  function showFloat() {
    root.classList.remove('hidden');
    restore.hidden = true;
    refresh();
  }

  function focusBigRows() {
    var rows = root.querySelectorAll('.qhf-row.big');
    if (rows.length) {
      setExpanded(false);
      rows.forEach(function (row) {
        row.classList.add('flash');
        setTimeout(function () { row.classList.remove('flash'); }, 2200);
      });
      rows[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      openRecordsPage();
    }
  }

  /* ---------- drag ---------- */
  function viewport() {
    return { w: window.innerWidth, h: window.innerHeight };
  }
  function place(x, y) {
    var vp = viewport();
    var maxX = Math.max(8, vp.w - root.offsetWidth - 8);
    var maxY = Math.max(8, vp.h - root.offsetHeight - 8);
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    root.style.left = Math.max(8, Math.min(maxX, x)) + 'px';
    root.style.top = Math.max(8, Math.min(maxY, y)) + 'px';
  }
  function keepInView() {
    var r = root.getBoundingClientRect();
    var vp = viewport();
    if (r.left < 8 || r.top < 8 || r.right > vp.w - 8 || r.bottom > vp.h - 8) {
      place(r.left, Math.min(r.top, vp.h - root.offsetHeight - 12));
    }
  }
  function snap() {
    var r = root.getBoundingClientRect();
    var vp = viewport();
    if (r.left < 30) place(10, r.top);
    else if (vp.w - r.right < 30) place(vp.w - root.offsetWidth - 10, r.top);
  }

  root.addEventListener('pointerdown', function (e) {
    if (e.target.closest('button') || e.target.closest('.qhf-flow') || e.target.closest('.qhf-detail')) return;
    drag = true;
    moved = false;
    suppressClick = false;
    sx = e.clientX;
    sy = e.clientY;
    var r = root.getBoundingClientRect();
    ox = r.left;
    oy = r.top;
    root.classList.add('dragging');
    try { root.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  root.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - sx;
    var dy = e.clientY - sy;
    if (!moved && Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    if (moved) place(ox + dx, oy + dy);
  });
  function endDrag() {
    if (!drag) return;
    drag = false;
    root.classList.remove('dragging');
    if (moved) {
      suppressClick = true;
      snap();
      setTimeout(function () { suppressClick = false; }, 80);
    }
    moved = false;
  }
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);

  root.addEventListener('dblclick', function (e) {
    if (e.target.closest('button')) return;
    if (tapTimer) { clearTimeout(tapTimer); tapTimer = 0; }
    openRecordsPage();
  });

  root.addEventListener('click', function (e) {
    if (suppressClick) return;
    if (!root.classList.contains('compact')) return;
    if (e.target.closest('button')) return;
    if (tapTimer) { clearTimeout(tapTimer); tapTimer = 0; return; }
    tapTimer = setTimeout(function () {
      tapTimer = 0;
      setCompact(false);
    }, 280);
  });

  /* ---------- buttons ---------- */
  root.querySelector('.qhf-x').addEventListener('click', function (e) {
    e.stopPropagation();
    hideFloat();
  });
  restore.addEventListener('click', showFloat);

  root.querySelector('.qhf-tools').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.dataset.act;
    if (act === 'mask') setMasked(!masked);
    else if (act === 'refresh') {
      refresh();
      btn.classList.add('on');
      var svg = btn.querySelector('svg');
      if (svg) { svg.style.transition = 'transform .55s ease'; svg.style.transform = 'rotate(360deg)'; }
      setTimeout(function () {
        btn.classList.remove('on');
        if (svg) { svg.style.transition = ''; svg.style.transform = ''; }
      }, 560);
      syncEl.textContent = '刚刚更新';
      syncEl.classList.remove('demo');
      clearTimeout(root.__syncTimer);
      root.__syncTimer = setTimeout(function () {
        var demo = (typeof SIM_TIME !== 'undefined') && SIM_TIME != null;
        syncEl.textContent = demo ? '演示时间 ' + fmtDate(simNow()) : '已同步';
        syncEl.classList.toggle('demo', !!demo);
      }, 3600);
    } else if (act === 'expand') setExpanded(!expanded);
    else if (act === 'open') openRecordsPage();
    else if (act === 'compact') setCompact(true);
  });

  moreEl.addEventListener('click', function (e) {
    e.stopPropagation();
    if (alertEl.dataset.act === 'budget' && typeof openBudgetModal === 'function') {
      openBudgetModal();
      return;
    }
    focusBigRows();
  });

  pendingEl.addEventListener('click', function (e) {
    e.stopPropagation();
    location.hash = '#/records';
  });

  /* ---------- data sync ---------- */
  function dataKey() {
    try {
      return [
        S.budget,
        S.records.length,
        monthRecords().length,
        monthSpent(),
        (S.records[0] && S.records[0].id) || '',
        (S.records[S.records.length - 1] && S.records[S.records.length - 1].id) || '',
        (typeof SIM_TIME !== 'undefined') ? SIM_TIME : '',
        pendingCount(),
        S.identity,
        S.authorized
      ].join('|');
    } catch (err) {
      return '';
    }
  }
  function tick() {
    var k = dataKey();
    if (k !== lastKey) {
      lastKey = k;
      refresh();
    }
  }

  /* 立即刷新一次，并按 2s 兜底轮询（SSE / 表单 / 时钟变化） */
  refresh();
  lastKey = dataKey();
  setInterval(tick, 2000);
  window.addEventListener('hashchange', tick);
  window.addEventListener('storage', tick);
  window.addEventListener('resize', keepInView);

  /* 包装全局 render：路由切换、记账、实时流水到达时立即刷新 */
  if (typeof window.render === 'function') {
    var origRender = window.render;
    window.render = function () {
      var out = origRender.apply(this, arguments);
      tick();
      return out;
    };
  }
})();
