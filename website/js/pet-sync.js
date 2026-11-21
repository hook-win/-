/* ============================================================
   月尺 · 桌宠实时流水同步（网页 → 桌面桌宠）
   ------------------------------------------------------------
   把当前「预算 / 本月已花 / 今日花费 / 剩余天数 / 最近 3 笔流水」
   通过本机接口 http://127.0.0.1:51888/data 推送给 QinghePet.exe。
   · 数据一变就同步（render、路由、模拟流水、定时兜底）
   · 桌宠没运行或接口不可达时静默失败，不影响网页任何功能
   · 桌宠不再使用 settings.ini 里的预设流水
   ============================================================ */
(function () {
  'use strict';
  if (window.__qhPetSyncMounted) return;
  window.__qhPetSyncMounted = true;

  var ENDPOINT = 'http://127.0.0.1:51888/data';
  var FEED_LIMIT = 3;
  var INTERVAL = location.protocol === 'file:' ? 4000 : 2500;
  var RESEND_MS = 60000;
  var lastSig = '';
  var lastSendAt = 0;

  function num(v, d) {
    v = Number(v);
    return isFinite(v) ? v : (d || 0);
  }

  function nowDate() {
    try { return (typeof simNow === 'function') ? simNow() : new Date(); } catch (e) { return new Date(); }
  }

  function dayLabel(dateStr) {
    if (!dateStr) return '';
    var d = new Date(String(dateStr).replace(/-/g, '/') + ' 00:00:00');
    if (isNaN(d.getTime())) return '';
    var n = nowDate();
    var a = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    var b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var diff = Math.round((a - b) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    if (diff === 2) return '前天';
    var mm = String(d.getMonth() + 1);
    var dd = String(d.getDate());
    if (mm.length < 2) mm = '0' + mm;
    if (dd.length < 2) dd = '0' + dd;
    return d.getFullYear() === n.getFullYear() ? mm + '-' + dd : d.getFullYear() + '-' + mm + '-' + dd;
  }

  function fmtMoney(v) {
    var n = Math.round(Number(v) * 100) / 100;
    return String(n);
  }

  function currentRecords() {
    try {
      if (typeof S === 'undefined' || !S || !Array.isArray(S.records)) return [];
      return S.records.filter(function (r) {
        return r && r.merchant && isFinite(Number(r.amount));
      });
    } catch (e) { return []; }
  }

  function recent() {
    var list = currentRecords();
    list.sort(function (a, b) {
      var ka = String(a.date || '') + ' ' + String(a.time || '');
      var kb = String(b.date || '') + ' ' + String(b.time || '');
      return kb.localeCompare(ka);
    });
    return list.slice(0, FEED_LIMIT);
  }

  function todaySpent() {
    var day;
    try { day = (typeof dstr === 'function') ? dstr(0) : ''; } catch (e) { day = ''; }
    if (!day) return 0;
    return currentRecords().reduce(function (sum, r) {
      if (String(r.date || '') !== day) return sum;
      return sum + num(r.amount);
    }, 0);
  }

  function snapshot() {
    var budget = 0, spent = 0, days = 0;
    try {
      if (typeof S !== 'undefined' && S) budget = num(S.budget);
      if (typeof monthSpent === 'function') spent = num(monthSpent());
      if (typeof daysLeft === 'function') days = num(daysLeft());
    } catch (e) {}

    var feed = recent().map(function (r) {
      var name = String(r.merchant).replace(/[|;]/g, ' ').slice(0, 16);
      return [name, fmtMoney(r.amount), dayLabel(r.date)].join('|');
    }).join(';');

    return {
      budget: budget,
      spent: spent,
      today: todaySpent(),
      days: days,
      transactions: feed,
      website: location.href
    };
  }

  function signature(d) {
    return [Math.round(d.budget), d.spent.toFixed(2), d.today.toFixed(2), Math.round(d.days), d.transactions].join('~');
  }

  /* file:// 协议下浏览器不允许 fetch 带 keepalive 发往 http 目标（会直接抛错），
     而直接双击 index.html 正是最常见的打开方式。这里改用隐藏 iframe + 表单 POST：
     表单提交不受 CORS / 源协议限制，且 Content-Type 天然是 x-www-form-urlencoded，
     正好对应桌宠 DataListener.ParseForm。 */
  var frame = null;
  function postViaForm(body) {
    if (!document.body) return;
    if (!frame) {
      frame = document.createElement('iframe');
      frame.name = 'qhpet-sync-frame';
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
      frame.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none';
      document.body.appendChild(frame);
    }
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = ENDPOINT;
    form.target = frame.name;
    form.style.display = 'none';
    body.split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      if (i < 0) return;
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = decodeURIComponent(pair.slice(0, i));
      input.value = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
      form.appendChild(input);
    });
    document.body.appendChild(form);
    try { form.submit(); } catch (e) {}
    setTimeout(function () { if (form.parentNode) form.parentNode.removeChild(form); }, 1500);
  }

  function send(d) {
    // 桌宠的 DataListener 只解析 POST 请求体（application/x-www-form-urlencoded 语义）。
    // 注意：不能带 keepalive —— file:// 页面下浏览器会直接抛错，请求根本发不出去。
    // website 只在 http(s) 页面下更新，避免把桌宠「打开网页」写成 file:// 地址
    // （file:// 与 localhost 不同源，localStorage 不共享，会看不到网页里的数据）。
    var web = (location.protocol === 'http:' || location.protocol === 'https:')
      ? location.href
      : 'http://localhost:3000/#/home';
    var body = 'budget=' + Math.round(d.budget) +
      '&spent=' + d.spent.toFixed(2) +
      '&today=' + d.today.toFixed(2) +
      '&days=' + Math.round(d.days);
    if (d.transactions) body += '&transactions=' + encodeURIComponent(d.transactions);
    if (location.protocol !== 'file:') {
      body += '&website=' + encodeURIComponent(web) +
        '&source=' + encodeURIComponent(web);
    }
    if (location.protocol === 'file:') {
      // file:// 页面 fetch http 目标会被 CORS/私有网络策略拦截，直接走表单
      postViaForm(body);
      return;
    }
    try {
      if (window.fetch) {
        fetch(ENDPOINT, {
          method: 'POST',
          mode: 'no-cors',
          body: body
        }).catch(function () {});
        return;
      }
    } catch (e) {
      // 少数环境下简单请求也被拦截，退回隐藏 iframe 表单提交
    }
    postViaForm(body);
  }

  function hasData(d) {
    return d.budget > 0 || !!d.transactions;
  }

  function sync(force) {
    var d = snapshot();
    // 网页还没有预算 / 流水时不推送：否则会把桌宠清成「¥0 / ¥1」或空流水
    if (!hasData(d)) return;
    var sig = signature(d);
    if (!force && sig === lastSig) return;
    lastSig = sig;
    lastSendAt = Date.now();
    send(d);
  }

  var queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; sync(false); }, 120);
  }

  function boot() {
    sync(true);

    var orig = window.render;
    if (typeof orig === 'function' && !orig.__qhPetWrapped) {
      var wrapped = function () {
        var out = orig.apply(this, arguments);
        queue();
        return out;
      };
      wrapped.__qhPetWrapped = true;
      window.render = wrapped;
    }

    window.addEventListener('hashchange', queue);
    window.addEventListener('storage', queue);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) sync(true);
    });

    /* 桌宠的 DataListener 会把 transactions 写进主设置，但 budget / spent / today / days
       可能落到临时实例上，被它的定时保存覆盖。早先版本用 600ms 全量推送硬压，
       会产生大量 TIME_WAIT 连接、拖慢系统。现在改成：
       · 数据不变就不发；· 最多 15 秒补发一次防止被回写；· file:// 下再用 4 秒节流。
       网页没有预算/流水时完全不发，避免把桌宠清空。 */
    setInterval(function () {
      if (document.hidden) return;
      var d = snapshot();
      if (!hasData(d)) return;
      if (signature(d) === lastSig && Date.now() - lastSendAt < RESEND_MS) return;
      sync(false);
    }, INTERVAL);
  }

  window.QHPetSync = {
    sync: function () { sync(true); },
    snapshot: snapshot
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
