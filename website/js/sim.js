'use strict';
/* v2.1 实时流水演示:接入模拟银行流水服务(SSE),演示时钟跟随流水时间自动切换年月。
   契约:id/time/amount/direction/counterparty/summary/channel/location/locationVisible */

const SIM_DEFAULT_BASE = 'http://localhost:3000';
const SIM = {
  base: SIM_DEFAULT_BASE,
  es: null,
  connected: false,
  error: null,
  playing: false,
  speed: 1500,
  cursor: 0,
  total: 251,
  done: false,
  feed: []
};

function simParseTime(t) {
  const s = String(t || '');
  return { date: s.slice(0, 10), hm: s.slice(11, 16), ms: new Date(s.replace(' ', 'T')).getTime() };
}

function simAdvanceClock(ms) {
  if (!isFinite(ms)) return { monthChanged: false, yearChanged: false };
  if (SIM_TIME != null && ms <= SIM_TIME) return { monthChanged: false, yearChanged: false };
  const prev = SIM_TIME != null ? new Date(SIM_TIME) : null;
  SIM_TIME = ms;
  S.simTime = ms;
  const now = new Date(ms);
  const monthChanged = !!prev && (prev.getFullYear() !== now.getFullYear() || prev.getMonth() !== now.getMonth());
  const yearChanged = !!prev && prev.getFullYear() !== now.getFullYear();
  return { monthChanged, yearChanged, now };
}

function simIngest(tx) {
  if (!S.authorized || !tx || !tx.id) return false;
  const { date, hm, ms } = simParseTime(tx.time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const amount = Math.abs(Math.round(Number(tx.amount) * 100) / 100);
  if (!(amount > 0)) return false;
  const isIn = tx.direction === 'in' || Number(tx.amount) > 0;

  const dup = isIn
    ? S.deposits.some((d) => d.simId === tx.id)
    : S.records.some((r) => r.simId === tx.id);

  const clk = simAdvanceClock(ms);
  if (dup) return false;

  let tag;
  if (isIn) {
    const dep = { id: uid(), simId: tx.id, label: `${tx.counterparty}·${tx.summary}`, amount, date };
    S.deposits.push(dep);
    potsOnIncome(dep);
    tag = { cls: 'ok', text: '入账已登记' };
    if (/工资/.test(tx.summary || '') && S.identity === 'student' && !S.simWorkerHinted) {
      S.simWorkerHinted = true;
      careToast('检测到工资入账，恭喜步入职场！可在「身份切换」体验上班族的收入规划能力。');
    }
  } else {
    const before = pctNow();
    const c = classify(tx.counterparty, amount, hm, S.records);
    const rec = { id: uid(), simId: tx.id, src: 'live', date, time: hm, merchant: tx.counterparty, amount, ...c };
    S.records.push(rec);
    if (c.confirmed) potsOnSpend(rec);
    tag = c.tier === 'high'
      ? { cls: 'ok', text: `高置信 · ${catOf(c.cat).name}` }
      : c.tier === 'mid'
        ? { cls: 'warn', text: `猜 ${c.guessLabel} · 待确认` }
        : { cls: 'mute', text: '未分类池' };
    checkCross(before, pctNow());
  }

  SIM.feed.unshift({ tx, date, hm, isIn, amount, tag });
  if (SIM.feed.length > 40) SIM.feed.length = 40;

  if (clk.yearChanged) toast(`演示时间跨入 ${clk.now.getFullYear()} 年，年度统计已自动切换`);
  else if (clk.monthChanged) toast(`演示时间进入 ${clk.now.getFullYear()} 年 ${clk.now.getMonth() + 1} 月，本月统计已自动切换`);
  return true;
}

function simPurgeLive() {
  S.records = S.records.filter((r) => r.src !== 'live');
  S.deposits = S.deposits.filter((d) => !d.simId);
  S.potLedger = S.potLedger.filter((e) => !e.simId);
  SIM.feed = [];
  SIM_TIME = null;
  S.simTime = null;
  historyMonth = null;
}

function simEditing() {
  const ae = document.activeElement;
  const view = document.getElementById('view');
  return ae && view && view.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
}

function simUpdateChip() {
  const chip = document.getElementById('simChip');
  if (!chip) return;
  if (SIM_TIME == null) { chip.hidden = true; return; }
  chip.hidden = false;
  chip.textContent = `演示时间 ${fmtDate(simNow())}`;
  chip.classList.toggle('playing', SIM.connected && SIM.playing);
}

function simRender() {
  simUpdateChip();
  if (!simEditing()) render();
}

function simApplyStatus(d) {
  if (!d) return;
  if (d.cursor < SIM.cursor) simPurgeLive();
  SIM.playing = !!d.playing;
  SIM.speed = d.speed || SIM.speed;
  SIM.cursor = d.cursor || 0;
  SIM.total = d.total || SIM.total;
  SIM.done = !!d.done;
  simRender();
}

function simConnect(base) {
  if (base) SIM.base = base.replace(/\/+$/, '');
  if (SIM.es) { SIM.es.close(); SIM.es = null; }
  SIM.error = null;
  let es;
  try { es = new EventSource(SIM.base + '/events'); }
  catch (e) { SIM.error = '无法创建连接:' + e.message; simRender(); return; }
  SIM.es = es;
  es.addEventListener('ready', (e) => {
    let d; try { d = JSON.parse(e.data); } catch (err) { return; }
    SIM.connected = true;
    SIM.error = null;
    (d.recent || []).forEach((tx) => simIngest(tx));
    simApplyStatus(d.status);
  });
  es.addEventListener('transaction', (e) => {
    let tx; try { tx = JSON.parse(e.data); } catch (err) { return; }
    simIngest(tx);
    simRender();
  });
  es.addEventListener('status', (e) => {
    let d; try { d = JSON.parse(e.data); } catch (err) { return; }
    simApplyStatus(d);
  });
  es.onerror = () => {
    SIM.connected = false;
    SIM.error = `无法连接 ${SIM.base}，请确认模拟流水服务已启动`;
    simRender();
  };
}

function simDisconnect() {
  if (SIM.es) { SIM.es.close(); SIM.es = null; }
  SIM.connected = false;
  SIM.playing = false;
  S.simDisconnected = true;
  save();
  simRender();
}

function simControl(action, speed) {
  /* 部分服务端要求 action 必填:仅改速度时附带当前播放状态 */
  if (speed != null && !action) action = SIM.playing ? 'play' : 'pause';
  const body = {};
  if (action) body.action = action;
  if (speed != null) body.speed = speed;
  fetch(SIM.base + '/player/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
    .then((r) => r.json())
    .then((d) => { if (d.error) toast('控制失败:' + d.error); else simApplyStatus(d); })
    .catch(() => toast('控制失败:无法连接模拟流水服务'));
}

function simLoadAll() {
  if (!S.authorized) { toast('请先完成授权'); return; }
  fetch(SIM.base + '/transactions/all')
    .then((r) => r.json())
    .then((list) => {
      let n = 0;
      list.forEach((tx) => { if (simIngest(tx)) n++; });
      save();
      simRender();
      toast(n ? `已载入 ${n} 笔历史流水作为训练数据，演示时钟已对齐到最新一笔` : '历史流水均已入库，没有新增');
    })
    .catch(() => toast('载入失败:无法连接模拟流水服务'));
}

function simBoot() {
  simUpdateChip();
  if (S.authorized && !S.simDisconnected) simConnect();
}

/* ---------- 视图 ---------- */
function simConsentHTML() {
  return `
  <div class="card auth-card">
    <h3 class="auth-h">接入模拟银行流水，先由你决定</h3>
    <p class="sub">演示版 v2.1 可接入本地模拟流水服务：251 笔交易覆盖大一入学到工作首年，实时推送进账本。接入前请确认授权。</p>
    <div data-consent-scope>
      <div class="consent-box">
        <label class="consent-line"><input type="checkbox" data-change="auth-consent">
          <span>我同意接入模拟流水服务，将其推送的交易用于消费归类与规划演示。是否接入完全由我决定。</span></label>
        <div class="auth-disclosure" hidden>
          <div><b>数据范围</b>：模拟流水服务推送的交易时间、金额、对方户名、摘要、交易渠道、部分可见地点，均为演示用模拟数据。</div>
          <div><b>用途</b>：仅用于消费归类与规划建议演示；不做后台推断，不用于授信。</div>
          <div><b>存储</b>：入库记录仅保存在本机浏览器，可随时在下方「重置演示」一键清除。</div>
          <div><b>时钟</b>：接入后首页与统计的「当前年月」跟随流水时间自动切换，可随时恢复真实时间。</div>
        </div>
      </div>
      <div class="row mt">
        <button class="btn primary auth-agree" data-action="live-agree" disabled>同意并接入实时流水</button>
      </div>
      <p class="dim mt">不接入也可以使用全部手动记账功能，我们不会反复提示。</p>
    </div>
  </div>
  <div class="notice">模拟流水服务默认运行在 http://localhost:3000（队友的演示服务或本项目 simulator/ 备用服务均可）。银行侧可见字段之外不生成任何数据：第三方支付显示为聚合主体，部分交易地点不可见。</div>`;
}

function simFeedHTML() {
  if (!SIM.feed.length) return '<div class="empty"><div class="big">还没有收到流水</div>服务播放后，交易会实时滚入这里并自动归类</div>';
  return `<div class="list sim-feed">${SIM.feed.map((f, i) => `
    <div class="list-item ${i === 0 ? 'sim-new' : ''}">
      <div class="grow">
        <div class="title">${esc(f.tx.counterparty)}</div>
        <div class="meta">${f.date} ${f.hm} · ${esc(f.tx.summary || '')} · ${esc(f.tx.channel || '')} · ${f.tx.locationVisible && f.tx.location ? esc(f.tx.location) : '地点未显示'}</div>
      </div>
      <span class="tag ${f.tag.cls}">${esc(f.tag.text)}</span>
      <span class="amount ${f.isIn ? 'in' : 'out'}">${f.isIn ? '+' : '-'}${money(f.amount)}</span>
    </div>`).join('')}</div>`;
}

function viewLive() {
  if (!S.authorized) return simConsentHTML();
  const liveRecs = S.records.filter((r) => r.src === 'live');
  const liveDeps = S.deposits.filter((d) => d.simId);
  const pct = SIM.total ? Math.round(SIM.cursor / SIM.total * 100) : 0;
  const clockLabel = SIM_TIME != null
    ? `${fmtDate(simNow())} · 跟随流水自动切换`
    : `${fmtDate(new Date())} · 真实时间`;
  const connTag = SIM.connected
    ? '<span class="tag ok">已连接</span>'
    : `<span class="tag mute">${SIM.error ? '连接失败' : '未连接'}</span>`;
  const playTag = SIM.done
    ? '<span class="tag info">已播完</span>'
    : SIM.playing ? '<span class="tag ok">播放中</span>' : '<span class="tag warn">已暂停</span>';
  const speeds = [[3000, '0.5x'], [1500, '1x'], [750, '2x'], [375, '4x']];
  return `
  <div class="card">
    <div class="spread">
      <div><h3>演示时钟</h3><p class="sub" style="margin:0">计时功能：每笔流水到达时，系统「当前日期」推进到该笔交易时间，跨月 / 跨年自动切换统计</p></div>
      ${connTag}
    </div>
    <div class="sim-clock num">${clockLabel}</div>
    <div class="spread mt">
      <span class="dim">播放进度 ${SIM.cursor} / ${SIM.total}</span>${playTag}
    </div>
    <div class="bar" style="margin-top:6px"><i style="width:${pct}%"></i></div>
    ${SIM.error ? `<div class="notice rose mt">${esc(SIM.error)}</div>` : ''}
    <div class="toolbar mt">
      <button class="btn primary" data-action="sim-play">${SIM.playing ? '暂停' : SIM.done ? '重新播放' : '继续播放'}</button>
      <div class="field" style="margin:0;flex-direction:row;align-items:center;gap:8px">
        <label style="white-space:nowrap">速度</label>
        <select class="inline-select" data-change="sim-speed">
          ${speeds.map(([v, l]) => `<option value="${v}" ${SIM.speed === v ? 'selected' : ''}>${l}（${v}ms/笔）</option>`).join('')}
        </select>
      </div>
      <button class="btn" data-action="sim-load-all">载入全部历史（训练）</button>
      <button class="btn" data-action="sim-realtime">恢复真实时间</button>
      <button class="btn danger" data-action="sim-reset">重置演示</button>
    </div>
    <div class="toolbar mt">
      <div class="field" style="margin:0;flex:1;min-width:220px"><label>模拟流水服务地址</label>
        <input id="simBase" value="${esc(SIM.base)}" placeholder="http://localhost:3000"></div>
      ${SIM.connected
        ? '<button class="btn" data-action="sim-disconnect" style="align-self:flex-end">断开接入</button>'
        : '<button class="btn primary" data-action="sim-reconnect" style="align-self:flex-end">接入实时流水</button>'}
    </div>
    <p class="dim mt">入账自动登记为大额到账（订阅理财建议后才会展示建议）；支出走三档置信度归类。工资入账时会提示体验上班族身份。</p>
  </div>
  <div class="stat-line">
    <div><b>${liveRecs.length}</b><span>已接入支出</span></div>
    <div><b>${money(liveRecs.reduce((s, r) => s + r.amount, 0))}</b><span>接入支出合计</span></div>
    <div><b>${liveDeps.length}</b><span>入账登记</span></div>
    <div><b>${money(monthSpent())}</b><span>当前演示月已花</span></div>
  </div>
  <div class="card">
    <div class="spread"><h3>实时流水</h3><span class="dim">最近 ${SIM.feed.length} 笔 · 按 id 去重，不会重复计数</span></div>
    <p class="sub">字段为银行流水可见范围；收入红 / 支出绿，归类结果实时标注</p>
    ${simFeedHTML()}
  </div>
  <div class="notice">演示数据说明：流水来自本地模拟服务（固定种子，可复现），不是真实银行数据；入库后仅存本机浏览器。「重置演示」会清空接入的记录并把播放进度归零。</div>`;
}

/* ---------- 事件 ---------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  if (a === 'live-agree') {
    const scope = t.closest('[data-consent-scope]');
    if (!scope.querySelector('input[data-change="auth-consent"]').checked) return toast('请先勾选同意授权');
    S.scheme = 'A'; S.authorized = true; S.simDisconnected = false;
    save(); render();
    simConnect();
    toast('已授权，正在接入模拟流水服务');
    return;
  }
  if (a === 'sim-play') { simControl(SIM.playing ? 'pause' : 'play'); return; }
  if (a === 'sim-load-all') { simLoadAll(); return; }
  if (a === 'sim-realtime') {
    SIM_TIME = null; S.simTime = null;
    save(); render();
    toast('已恢复真实时间，统计按当前日期计算');
    return;
  }
  if (a === 'sim-reset') {
    confirmModal('重置流水演示', '将清空所有接入的模拟流水记录与入账登记，演示时钟回到真实时间，并把服务端播放进度归零重新播放。手动填写的记录不受影响。', '重置演示', () => {
      simPurgeLive();
      simControl('reset');
      save(); render();
      toast('演示已重置，流水将从第一笔重新播放');
    }, true);
    return;
  }
  if (a === 'sim-disconnect') { simDisconnect(); toast('已断开实时流水接入'); return; }
  if (a === 'sim-reconnect') {
    const inp = document.getElementById('simBase');
    S.simDisconnected = false;
    save();
    simConnect(inp ? inp.value.trim() : SIM.base);
    toast('正在接入 ' + SIM.base);
    return;
  }
});

document.addEventListener('change', (e) => {
  const t = e.target.closest('[data-change]');
  if (!t) return;
  if (t.dataset.change === 'sim-speed') simControl(null, Number(t.value));
});