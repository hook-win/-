/* ============================================================
   月尺 · 周目标 + 拼豆积分
   月内四段：1–7 / 8–14 / 15–21 / 22–月末
   每段花费不超过周预算 → 300 分；连续达成有加成；下周达成可补签
   点击右下角挂件，把本周预算、已花、累计积分发给桌面桌宠的拼豆板。
   不改动网页原有的路由与记账逻辑。
   ============================================================ */
(function () {
  'use strict';
  if (window.__qhBeadGoal) return;
  window.__qhBeadGoal = true;

  var BASE_POINTS = 300;
  var BONUS = [0, 50, 100, 150];
  var SIGN_POINTS = 150;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function now() {
    try { return (typeof simNow === 'function') ? simNow() : new Date(); }
    catch (e) { return new Date(); }
  }
  function monthKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function segments(days) { return [[1, 7], [8, 14], [15, 21], [22, days]]; }
  function budget() { try { return Number(S.budget) || 0; } catch (e) { return 0; } }
  function records() { try { return (typeof monthRecords === 'function') ? monthRecords() : []; } catch (e) { return []; } }
  function dayOf(r) { var p = String(r.date || '').split('-'); return Number(p[2]) || 0; }
  function spentIn(seg) {
    return records().filter(function (r) { var d = dayOf(r); return d >= seg[0] && d <= seg[1]; })
      .reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
  }
  function currentWeek(days, today) {
    var segs = segments(days);
    for (var i = 0; i < 4; i++) if (today <= segs[i][1]) return i + 1;
    return 4;
  }
  function weekBudget(seg, days, total) {
    return total * (seg[1] - seg[0] + 1) / days;
  }

  function ensureState(mk) {
    if (!S.bead || typeof S.bead !== 'object') S.bead = { month: mk, weeks: {}, points: 0, signed: [] };
    if (S.bead.month !== mk) { S.bead.month = mk; S.bead.weeks = {}; S.bead.signed = []; }
    if (typeof S.bead.points !== 'number') S.bead.points = 0;
    if (!Array.isArray(S.bead.signed)) S.bead.signed = [];
    if (!S.bead.weeks || typeof S.bead.weeks !== 'object') S.bead.weeks = {};
    return S.bead;
  }

  function settle() {
    var d = now();
    var mk = monthKey(d);
    var days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    var today = d.getDate();
    var st = ensureState(mk);
    var segs = segments(days);
    var changed = false;
    var streak = 0;
    var lastDay = today === days;

    for (var i = 0; i < 4; i++) {
      var id = i + 1;
      var seg = segs[i];
      // 前三段在结束后结算；最后一段在月末当天结算，避免跨月后丢失
      if (seg[1] >= today && !(lastDay && i === 3)) break;
      if (st.weeks[id]) {
        streak = st.weeks[id].status === 'done' ? streak + 1 : 0;
        continue;
      }
      var b = weekBudget(seg, days, budget());
      var sp = spentIn(seg);
      var done = b > 0 && sp <= b;
      var award = 0;
      if (done) {
        award = BASE_POINTS + (streak > 0 ? BONUS[Math.min(streak, 3)] : 0);
        if (i > 0 && st.weeks[i] && st.weeks[i].status === 'miss' && st.signed.indexOf(i) < 0) {
          award += SIGN_POINTS;
          st.signed.push(i);
        }
        streak++;
      } else {
        streak = 0;
      }
      st.weeks[id] = { status: done ? 'done' : 'miss', spent: sp, budget: b, points: award };
      st.points += award;
      changed = true;
    }

    if (changed) {
      try { save(); } catch (e) {}
    }
    return { d: d, mk: mk, days: days, today: today, segs: segs, week: currentWeek(days, today), st: st };
  }

  function doneWeeks(st) {
    var out = [];
    for (var i = 1; i <= 4; i++) if (st.weeks[i] && st.weeks[i].status === 'done') out.push(i);
    return out;
  }

  function currentInfo() {
    var s = settle();
    var seg = s.segs[s.week - 1];
    var b = weekBudget(seg, s.days, budget());
    var sp = spentIn(seg);
    var done = stWeekDone(s.st, s.week);
    return {
      week: s.week, seg: seg, budget: b, spent: sp, left: b - sp,
      done: done, points: s.st.points, days: s.days, month: s.mk,
      auto: doneWeeks(s.st)
    };
  }
  function stWeekDone(st, id) {
    return !!(st.weeks[id] && st.weeks[id].status === 'done');
  }

  /* ---------------------------------------------------------- 挂件 */
  var CSS = '' +
    '.qhbead{position:fixed;right:88px;bottom:26px;z-index:2147483000;display:flex;align-items:center;gap:12px;' +
      'padding:9px 14px 9px 15px;border-radius:14px;background:rgba(255,255,255,.97);border:1px solid #d6e6f8;' +
      'box-shadow:0 10px 26px -14px rgba(13,44,84,.18),0 2px 5px rgba(13,44,84,.08),0 0 22px -8px rgba(31,111,235,.22);cursor:pointer;' +
      'font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;transition:transform .18s,box-shadow .18s}' +
    '.qhbead:hover{transform:translateY(-2px);box-shadow:0 16px 34px -16px rgba(13,44,84,.22),0 3px 7px rgba(13,44,84,.1),0 0 28px -6px rgba(31,111,235,.3)}' +
    '.qhbead[data-tone="warn"]{border-color:#f0d9a8;background:linear-gradient(160deg,#fdf7ec,#fffdf8)}' +
    '.qhbead[data-tone="over"]{border-color:#f3c6c6;background:linear-gradient(160deg,#fdefef,#fffafa)}' +
    '.qhbead-kicker{font-size:9px;font-weight:800;letter-spacing:.14em;color:#7089a6;text-transform:uppercase}' +
    '.qhbead-main{font-size:13px;font-weight:750;color:#0b2545;margin-top:1px;white-space:nowrap}' +
    '.qhbead-main b{font-variant-numeric:tabular-nums;color:#0b4bb5}' +
    '.qhbead-side{padding-left:12px;border-left:1px solid #d9e6f5;text-align:right;min-width:48px}' +
    '.qhbead-side b{display:block;font-size:16px;font-weight:850;color:#0e9f6e;font-variant-numeric:tabular-nums;line-height:1.15}' +
    '.qhbead-side span{font-size:9px;color:#7089a6;font-weight:600}' +
    '.qhbead[data-tone="warn"] .qhbead-main b{color:#b45309}' +
    '.qhbead[data-tone="over"] .qhbead-main b{color:#b91c1c}' +
    '.qhbead[data-tone="over"] .qhbead-side b{color:#dc2626}' +
    '.qhbead-toast{position:fixed;right:22px;bottom:96px;z-index:2147483001;max-width:min(300px,80vw);' +
      'padding:10px 14px;border-radius:12px;background:rgba(11,37,69,.96);color:#f2f7ff;font-size:12px;line-height:1.6;' +
      'box-shadow:0 18px 40px -18px rgba(13,44,84,.3),0 0 24px -10px rgba(31,111,235,.28);opacity:0;transform:translateY(8px);transition:.22s;pointer-events:none}' +
    '.qhbead-toast.show{opacity:1;transform:none}' +
    '@media(max-width:920px){.qhbead{right:16px;bottom:156px}.qhbead-toast{right:16px;bottom:220px}}';
  function injectCSS() {
    if (document.getElementById('qhbead-style')) return;
    var st = document.createElement('style');
    st.id = 'qhbead-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  var el, toastEl, toastTimer;
  function money(n) {
    var v = Math.round(Math.abs(n));
    return '¥' + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function render() {
    if (!el) return;
    var info = currentInfo();
    if (info.budget <= 0) {
      el.innerHTML = '<div><div class="qhbead-kicker">周目标 · 月尺拼豆</div>' +
        '<div class="qhbead-main">先设置月预算，再开始拼</div></div>' +
        '<div class="qhbead-side"><b>—</b><span>积分</span></div>';
      return;
    }
    var tone = info.done ? 'good' : info.left < 0 ? 'over' : 'warn';
    el.dataset.tone = info.done ? 'good' : tone;
    var line;
    if (info.done) line = '本周达成 ✓ · 去拼' + info.week + ' 区';
    else if (info.left < 0) line = '本周超了 ' + money(-info.left);
    else line = '还能花 <b>' + money(info.left) + '</b>';
    el.innerHTML = '<div><div class="qhbead-kicker">第 ' + info.week + ' 周 / 4 · 月尺</div>' +
      '<div class="qhbead-main">' + line + '</div></div>' +
      '<div class="qhbead-side"><b>' + info.points + '</b><span>积分</span></div>';
    el.title = '本周目标 ' + money(info.budget) + ' · 已花 ' + money(info.spent) +
      (info.done ? ' · 已达成' : '') + ' · 点击打开桌宠拼豆板';
  }

  function toast(msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'qhbead-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 3400);
  }

  function launch() {
    var info = currentInfo();
    if (info.budget <= 0) { toast('先在首页设置月预算，周目标才有意义'); return; }
    var auto = info.auto.slice();
    if (info.done && auto.indexOf(info.week) < 0) auto.push(info.week);
    var body = 'action=bead&week=' + info.week +
      '&budget=' + Math.round(info.budget) +
      '&spent=' + info.spent.toFixed(2) +
      '&points=' + info.points +
      '&month=' + encodeURIComponent(info.month) +
      '&auto=' + auto.join(',');
    var done = false;
    try {
      fetch('http://127.0.0.1:51888/data', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: body
      }).then(function () {
        done = true;
        toast(info.done ? '拼豆板已打开，这一周可以收尾了' : '拼豆板已打开，本周达成后才能自动拼');
      }).catch(function () { fallback(); });
    } catch (e) { fallback(); }

    function fallback() {
      if (done) return;
      try {
        window.location.href = 'qinghefloat://bead?' + body;
        toast('正在唤起桌面桌宠…');
      } catch (e2) {
        toast('没有找到桌面桌宠，请先运行一次 QinghePet.exe');
      }
    }
  }

  function mount() {
    injectCSS();
    el = document.createElement('div');
    el.className = 'qhbead';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', '本周目标与拼豆');
    el.addEventListener('click', launch);
    document.body.appendChild(el);
    render();
    setInterval(render, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
