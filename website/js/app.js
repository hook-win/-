'use strict';

const LS_KEY = 'qhb-life-fee-v21';
let S = load();
let pendingPlan = null;
let confirmCb = null;
let recordFilter = { range: 30, cat: 'all', q: '' };
let recordView = 'list';
let anchorUnit = null;
let SV = null;
let lastRoute = null;

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = Object.assign(emptyState(), JSON.parse(raw));
      s.records.forEach((r) => { if (!r.tier) { r.tier = 'manual'; r.confirmed = true; } });
      SIM_TIME = s.simTime || null;
      return s;
    }
  } catch (e) { /* 损坏数据回落到空状态 */ }
  return emptyState();
}
function save() { localStorage.setItem(LS_KEY, JSON.stringify(S)); }
function resetDemo() {
  localStorage.removeItem(LS_KEY);
  S = emptyState();
  SV = null;
  SIM_TIME = null;
  save();
  location.hash = '#/home';
  render();
  toast('已清空全部填写数据');
}

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (n) => '¥' + Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
const uid = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => fmtDate(simNow());
const daysAgo = (date) => Math.floor((nowMs() - new Date(date + 'T00:00:00').getTime()) / DAY);

const GRADE_LABEL = { fresh: '大一', soph: '大二 / 大三', senior: '大四', grad: '研究生' };
const ID_DEFAULT = { fresh: 1500, soph: 1800, senior: 2000, grad: 2200 };
const GOAL_LABEL = { big: '攒钱买一件大东西', takeout: '控制外卖和奶茶', noloan: '月底不借钱', clear: '搞清楚钱花在哪' };
const RHYTHM_LABEL = { month: '家里按月给', term: '家里按学期给', part: '兼职收入', aid: '奖助贷' };
const RHYTHM_NOTE = {
  month: '按月到账，日均按本月剩余天数摊平。',
  term: '按学期到账，建议把学期总额再切一次月预算。',
  part: '兼职收入不稳定，预算建议按周重置。',
  aid: '奖助贷一次性到账，建议分月使用。'
};
const REMIND_LABEL = { now: '当场提醒', evening: '晚上汇总', self: '主动看时', none: '不用提醒' };
const INVEST_LABEL = { yes: '愿意看看', ask: '只在我问时', no: '不需要' };
const CHIP_TEXT = { ok: '节奏从容', warn: '留意区间', stop: '超出预算' };

function monthRecords() {
  const prefix = fmtDate(simNow()).slice(0, 7);
  return S.records.filter((r) => isClassified(r) && r.date.startsWith(prefix));
}
function monthSpent() { return monthRecords().reduce((s, r) => s + r.amount, 0); }
function pctNow() { return S.budget ? (monthSpent() / S.budget) * 100 : 0; }
function daysLeft() {
  const n = simNow();
  return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate() - n.getDate() + 1;
}
function dailyLeft() { return S.budget ? Math.max(0, S.budget - monthSpent()) / daysLeft() : 0; }
function todaySum() { return S.records.filter((r) => isClassified(r) && r.date === today()).reduce((s, r) => s + r.amount, 0); }
function smallRecords() {
  return S.records.filter((r) => isClassified(r) && daysAgo(r.date) < 30 && r.amount <= 50).sort((a, b) => b.date.localeCompare(a.date));
}
function smallSum(range) {
  return S.records.filter((r) => isClassified(r) && daysAgo(r.date) < range).reduce((s, r) => s + r.amount, 0);
}
function pendingMid() { return S.records.filter((r) => r.tier === 'mid' && !r.confirmed); }
function poolLow() { return S.records.filter((r) => r.tier === 'low' && !r.confirmed); }
function midGroups() {
  const m = {};
  pendingMid().forEach((r) => {
    const key = r.guess + '|' + r.guessLabel;
    (m[key] = m[key] || { key, guess: r.guess, label: r.guessLabel, items: [] }).items.push(r);
  });
  return Object.values(m);
}
function catSum(list) {
  const m = {};
  list.forEach((r) => { m[r.cat] = (m[r.cat] || 0) + r.amount; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
function stateOf(p) { return p > 100 ? 'stop' : p >= 80 ? 'warn' : 'ok'; }
function careText(p, has) {
  if (!has) return '还没有本月的支出记录。在下方或「消费记录」中填写后，这里会给出累计概览与关怀提醒。';
  if (p > 100) return '这个月有点满了，我们一起看看接下来怎么安排，没关系的。';
  if (p >= 80) return '进入留意区间，接下来几天留心小额支出就好，不用紧张。';
  return '节奏很稳，月底还能留出一些余地。保持自己的节奏，也记得偶尔犒劳一下自己。';
}

function anchorOptions() {
  const opts = [];
  const m = {};
  S.records.filter((r) => isClassified(r) && r.amount <= 50 && daysAgo(r.date) < 30).forEach((r) => {
    const e = (m[r.merchant] = m[r.merchant] || { n: 0, sum: 0, cat: r.cat });
    e.n++; e.sum += r.amount;
  });
  Object.entries(m).filter(([, v]) => v.n >= 2).sort((a, b) => b[1].n - a[1].n).slice(0, 3).forEach(([name, v]) => {
    const avg = Math.round(v.sum / v.n * 10) / 10;
    opts.push({ value: String(avg), label: `${name} · 均 ¥${avg}（${v.n} 次）`, ico: catOf(v.cat).ico, name });
  });
  if (S.survey && S.survey.unit) opts.push({ value: String(S.survey.unit), label: `问卷小额单价 · ¥${S.survey.unit}`, ico: 'i-coin', name: '笔小额消费' });
  return opts;
}
function unitPrice() { const o = anchorOptions(); return o.length ? +o[0].value : null; }

function goalInfo() {
  const sv = S.survey;
  if (!sv || !sv.goal || !S.budget) return null;
  const left = S.budget - monthSpent();
  const over = left < 0;
  const label = GOAL_LABEL[sv.goal];
  let progress = '', tip = '';
  if (sv.goal === 'big') {
    progress = over ? `已超 ${money0(-left)}` : `月底预计剩 ${money0(left)}`;
    tip = over ? '下个月重新来过，先稳住小额。' : `把月底剩下的转进目标账户，三个月就是 ${money0(left * 3)}。`;
  } else if (sv.goal === 'takeout') {
    const f = monthRecords().filter((r) => r.cat === 'food' && r.amount <= 50);
    const fs = f.reduce((s, r) => s + r.amount, 0);
    progress = `本月小额餐饮 ${f.length} 笔 / ${money(fs)}`;
    const u = unitPrice();
    tip = u ? `按 ${money(u)}/次算，一周少 2 次，一个月约省 ${money0(u * 8)}。` : '少点一次外卖，就离目标近一步。';
  } else if (sv.goal === 'noloan') {
    const perDay = S.budget / 30;
    const survive = perDay > 0 ? Math.floor(Math.max(0, left) / perDay) : 0;
    progress = over ? `已超 ${money0(-left)}` : `按日均可撑 ${survive} 天`;
    tip = dailyLeft() > 0 ? '按当前日均摊到月底没问题。' : '剩下的钱不够摊到月底，先从外卖开始收。';
  } else {
    const en = catSum(monthRecords());
    const spent = monthSpent();
    progress = en.length && spent ? `最大支出：${catOf(en[0][0]).name} ${Math.round(en[0][1] / spent * 100)}%` : '还没有本月记录';
    tip = '把常买的几笔归好类，小口子就看得见了。';
  }
  return { label, progress, tip };
}

function heatData() {
  const n = simNow();
  const year = n.getFullYear(), month = n.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const map = {};
  let total = 0, max = 0, zero = 0;
  const weekend = { sum: 0, n: 0 }, weekday = { sum: 0, n: 0 };
  for (let d = 1; d <= days; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const items = S.records.filter((r) => isClassified(r) && r.date === date);
    const sum = items.reduce((s, r) => s + r.amount, 0);
    map[date] = { sum, items };
    total += sum;
    max = Math.max(max, sum);
    if (d <= n.getDate()) {
      if (!sum) zero++;
      const dow = new Date(year, month, d).getDay();
      const b = (dow === 0 || dow === 6) ? weekend : weekday;
      if (sum) { b.sum += sum; b.n++; }
    }
  }
  return { year, month, days, map, total, max, zero, weekend, weekday };
}
function heatColor(v, max) {
  if (v === 0) return '#e6eef9';
  const r = v / max;
  if (r < 0.2) return '#c3d9f3';
  if (r < 0.45) return '#8fb6e8';
  if (r < 0.75) return '#4a89e0';
  return '#dc2626';
}

/* ---------- survey ---------- */
function svInit(from) {
  SV = { step: 0, a: { id: null, life: null, rhythm: null, goal: null, unit: null, remind: null, budgetMode: null, invest: null }, override: null };
  if (from && from.done) QUESTIONS.forEach((Q) => { if (from[Q.q] != null) SV.a[Q.q] = String(from[Q.q]); });
}
function svBudget() {
  if (SV.override) return SV.override;
  const l = SV.a.life;
  if (l && l !== 'uncertain') return +l;
  return ID_DEFAULT[SV.a.id] || 2000;
}
function svPreviewHTML() {
  const b = svBudget();
  const dl = daysLeft();
  const a = SV.a;
  const answered = Object.values(a).some((v) => v != null);
  return `
  <div class="bp-top"><span class="bp-brand">生活费管家 · 预览</span><span class="bp-tag ${answered ? 'live' : ''}">${answered ? '预览中' : '默认基准'}</span></div>
  <div class="bp-card">
    <span class="bp-lab">月预算（问卷建议）</span>
    <div class="bp-big num">${money0(b)}</div>
    <div class="bp-sub">日均可用 ${money0(b / dl)} · 本月剩余 ${dl} 天</div>
    <div class="bar"><i style="width:0%"></i></div>
  </div>
  <div class="bp-row"><span>提醒线（80%）</span><b class="num">${money0(b * 0.8)}</b></div>
  <div class="bp-row"><span>目标</span><b>${a.goal ? GOAL_LABEL[a.goal] : '还没设'}</b></div>
  <div class="bp-row"><span>提醒时机</span><b>${a.remind ? REMIND_LABEL[a.remind] : '还没设'}</b></div>
  <div class="bp-row"><span>理财意愿</span><b>${a.invest ? INVEST_LABEL[a.invest] : '还没设'}</b></div>
  <p class="bp-tip">${a.goal ? `生成后，首页会围绕「${GOAL_LABEL[a.goal]}」给你基于真实数据的建议。` : '答完八题，首页会按这些数字个性化渲染。'}</p>
  <p class="bp-note">预算来自你选的生活费区间或年级常见水平估算，生成后仍可手动微调；跳过问卷则完全自己填写。</p>`;
}
function svSync() {
  const p = $('#svPreview');
  if (p) p.innerHTML = svPreviewHTML();
  const nx = $('#svNext');
  if (nx) nx.disabled = SV.a[QUESTIONS[SV.step].q] == null;
}
function applySurvey() {
  const a = SV.a;
  const budget = svBudget();
  S.survey = { done: true, skipped: false, id: a.id, life: a.life, rhythm: a.rhythm, goal: a.goal, unit: a.unit, remind: a.remind, budgetMode: a.budgetMode, invest: a.invest, ts: today() };
  if (a.budgetMode !== 'later') S.budget = budget;
  S.thresholdMode = a.remind || 'self';
  if (a.invest === 'yes') S.wealthOptIn = true;
  if (a.invest === 'no') S.wealthOptIn = false;
  SV = null;
  save(); render();
  toast(S.scheme
    ? `基准已生成：预算 ${money0(S.budget || budget)}，首页已按你的答案个性化`
    : `基准已生成：预算 ${money0(S.budget || budget)}。下一步：决定是否授权导入历史消费`);
  if (a.budgetMode === 'self') openBudgetModal();
}

/* ---------- reminders ---------- */
const SMALL_MAX = 50;
function smallList(days) {
  return S.records.filter((r) => isClassified(r) && r.amount <= SMALL_MAX && daysAgo(r.date) >= 0 && daysAgo(r.date) < days);
}
function catStats(list, days) {
  const m = {};
  list.forEach((r) => {
    const e = (m[r.cat] = m[r.cat] || { cat: r.cat, n: 0, sum: 0, merchants: {}, night: 0 });
    e.n++; e.sum += r.amount;
    e.merchants[r.merchant] = (e.merchants[r.merchant] || 0) + 1;
    const h = r.time ? Number(r.time.slice(0, 2)) : null;
    if (h != null && h >= 21) e.night++;
  });
  return Object.values(m).map((e) => {
    const top = Object.entries(e.merchants).sort((a, b) => b[1] - a[1])[0];
    return { ...e, perWeek: e.n / (days / 7), avg: e.sum / e.n, top: top && top[1] >= 2 ? { name: top[0], n: top[1] } : null };
  }).sort((a, b) => b.n - a.n);
}
function catSummaryText(st, days) {
  const c = catOf(st.cat);
  const freq = st.perWeek >= 1 ? `平均每周 ${st.perWeek.toFixed(1)} 次` : `${days} 天里 ${st.n} 次`;
  let s = `${c.name} ${st.n} 笔 / ${money(st.sum)}（${freq}，单笔均 ${money(st.avg)}）`;
  if (st.top) s += `，最常去「${st.top.name}」（${st.top.n} 次）`;
  if (st.cat === 'food' && st.night >= 2) s += '，其中几笔在深夜';
  return s + '。';
}
function catCareAdvice(st) {
  const f = st.perWeek;
  if (st.cat === 'food') {
    let a = f >= 5
      ? '外卖和饮品好像是你日常的小陪伴，不用急着戒掉什么。如果想给月底留点余地，偶尔把一次外卖换成食堂就好，决定权在你。'
      : f >= 3
        ? '餐饮节奏挺规律的。想犒劳自己的时候就安心去，平常日子留意一下累计就好，不用紧张。'
        : '餐饮小额不多，节奏从容。记得按时吃饭，偶尔犒劳一下自己也是生活的一部分。';
    if (st.night >= 2) a += '深夜加餐没关系，也记得照顾一下胃和睡眠。';
    return a;
  }
  if (st.cat === 'daily') {
    return f >= 4
      ? '日用小件买得比较勤，多是生活里的小补充。下次补货前可以先看看家里已有的，避免重复囤货，就很从容了。'
      : f >= 2
        ? '日用消费很有节制，需要时才出手，这个节奏很舒服，保持就好。'
        : '日用小额很少，看起来生活安排得简单清爽。该添置的别省着，别委屈自己。';
  }
  if (st.cat === 'transport') {
    return f >= 4 ? '出行小额比较多，通勤很规律。留意末班车时间，早点回家，路上注意安全。' : '出行支出平稳，通勤节奏规律，保持就好。';
  }
  if (st.cat === 'fun') {
    return f >= 3 ? '娱乐小额是你给自己的小奖励，保持这份松弛感。预算之内，快乐很值得。' : '偶尔的娱乐是生活的透气口，这份小仪式感值得保留。';
  }
  if (st.cat === 'study') return '学习上的投入总是值得的，这些小额在悄悄为以后的你铺路。';
  return f >= 3 ? '这类小额有点频繁，可以看看具体是什么：需要的就安心买，冲动的话放一天再决定也不迟。' : '这类支出节奏平稳，不需要特别留意。';
}
function patternReminder() {
  let days = 30;
  let list = smallList(days);
  if (list.length < 3) { days = 90; list = smallList(days); }
  if (list.length < 3) { days = 180; list = smallList(days); }
  if (list.length < 3) return [];
  const stats = catStats(list, days);
  const total = list.reduce((s, r) => s + r.amount, 0);
  const lines = [`近 ${days} 天你有 ${list.length} 笔小额消费（单笔 ≤¥50），合计 ${money(total)}。先帮你把规律总结出来：`];
  stats.slice(0, 3).forEach((st) => lines.push('· ' + catSummaryText(st, days)));
  lines.push('想对你说的话：');
  stats.slice(0, 2).forEach((st) => lines.push('· ' + catCareAdvice(st)));
  lines.push('小额不可怕，也不需要戒掉什么。看清节奏之后，怎么安排始终由你决定。');
  return [{ id: 'pattern-' + today().slice(0, 7), date: today(), type: 'pattern', text: lines.join('\n') }];
}
function cumReminders() {
  const out = [];
  for (let w = 0; w < 4; w++) {
    const inWeek = S.records.filter((r) => { const d = daysAgo(r.date); return isClassified(r) && d >= w * 7 && d < (w + 1) * 7; });
    if (!inWeek.length) continue;
    const sum = inWeek.reduce((s, r) => s + r.amount, 0);
    const start = dstr((w + 1) * 7 - 1);
    const end = dstr(w * 7);
    const weekSmall = inWeek.filter((r) => r.amount <= SMALL_MAX);
    let body;
    if (weekSmall.length >= 2) {
      const stats = catStats(weekSmall, 7);
      const pattern = '本周小额规律：' + stats.slice(0, 2).map((st) => catSummaryText(st, 7)).join(' ');
      body = `${pattern}\n${catCareAdvice(stats[0])}`;
    } else {
      const prev = S.records.filter((r) => { const d = daysAgo(r.date); return isClassified(r) && d >= (w + 1) * 7 && d < (w + 2) * 7; });
      const prevSum = prev.reduce((s, r) => s + r.amount, 0);
      body = prevSum
        ? (sum > prevSum ? `比上一周的 ${money(prevSum)} 略多，留意一下累计的小口子就好，不用紧张。` : `上一周同期为 ${money(prevSum)}，节奏平稳，继续保持。`)
        : '这是有记录以来的第一周，慢慢来，先看清自己的节奏。';
    }
    out.push({
      id: 'cum-' + start,
      date: end,
      type: 'cumulative',
      text: `${start} 至 ${end} 你的支出累计 ${money(sum)}（${inWeek.length} 笔）。\n${body}\n记得偶尔犒劳一下自己。`
    });
  }
  return out;
}
function wealthReminders() {
  return S.deposits.map((d) => ({
    id: 'dep-' + d.id,
    date: d.date,
    type: 'wealth',
    text: `你登记的大额到账：${d.label} ${money(d.amount)}。建议先预留 3–6 个月生活费作为应急金，剩余部分再考虑稳健存放。以上仅参考，不构成投资邀约。`
  }));
}
function thresholdReminders() {
  if (!S.budget || S.thresholdMode === 'none') return [];
  const p = pctNow();
  if (p < 80) return [];
  return [{
    id: 'th-' + today().slice(0, 7),
    date: today(),
    type: 'threshold',
    text: p > 100
      ? `本月消耗已达 ${Math.round(p)}%，有点满了。我们一起看看接下来的安排，必要时调整一下计划，没关系的。`
      : `本月消耗已达 ${Math.round(p)}%，进入留意区间。不用紧张，接下来几天稍微留心小额支出就好。`
  }];
}
function visibleReminders() {
  return [...patternReminder(), ...cumReminders(), ...thresholdReminders(), ...catLimitReminders(), ...(S.wealthOptIn ? wealthReminders() : [])]
    .map((m) => ({ ...m, read: !!S.readRem[m.id] }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
function unreadCount() {
  return visibleReminders().filter((m) => !m.read).length;
}

function computeAdvice(plan) {
  const cum = smallSum(30);
  const ratio = S.budget ? cum / S.budget : 0;
  const pct = Math.round(ratio * 100);
  const left = (S.budget || 0) - monthSpent();
  let level, text;
  if (S.budget && ratio > 0.6) {
    level = 'stop';
    text = `近 30 天你的支出已累计 ${money(cum)}，占月生活费的 ${pct}%。建议暂缓这笔大额支出，先观察一到两周，等累计节奏回落后再做决定。`;
  } else if (S.budget && plan.amount > left) {
    level = 'stop';
    text = `计划金额 ${money(plan.amount)} 已超出本月余量 ${money(left)}。建议调整预算或延后购买。`;
  } else if (plan.trend === 'down') {
    level = 'warn';
    text = `你观察到该商品价格下行。当前近 30 天累计 ${money(cum)}${S.budget ? `（占 ${pct}%）` : ''}、本月余量 ${money(left)}。不急用的话可以再等一个促销节点；确有需要也可按计划购买。`;
  } else if (plan.trend === 'up') {
    level = 'warn';
    text = `你观察到该商品价格上行，等待未必更便宜。当前近 30 天累计 ${money(cum)}${S.budget ? `（占 ${pct}%）` : ''}、本月余量 ${money(left)}。若确有需要，建议在余量范围内尽早按计划购买。`;
  } else {
    level = 'ok';
    text = `基于你填写的数据：近 30 天累计 ${money(cum)}${S.budget ? `（占 ${pct}%）` : ''}、本月余量 ${money(left)}，这笔支出在可承受范围内，可按计划理性购买。${plan.trend === 'flat' ? '你观察到的价格趋势为平稳。' : '未填写价格观察时，建议仅基于预算与累计判断。'}`;
  }
  return { level, text, cum, ratio, left };
}
const LEVEL_TAG = { ok: ['ok', '可按计划'], warn: ['warn', '建议等待'], stop: ['stop', '建议暂缓'] };
const TREND_LABEL = { down: '下行', flat: '平稳', up: '上行' };

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z"/><path d="M9 8h6M9 12h6"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h13l-3-3"/><path d="M20 17H7l3 3"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  piggy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><path d="M16 11h.01"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-6 4 12L16 12h5"/></svg>',
  pots: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8"/><path d="M9 3v3.5C6.5 8 5 10.5 5 13.5 5 18 8 21 12 21s7-3 7-7.5c0-3-1.5-5.5-4-7V3"/><path d="M9 13h6"/></svg>'
};

const ROUTES = {
  home: ['首页总览', viewHome],
  privacy: ['授权与隐私设置', viewPrivacy],
  records: ['消费记录', viewRecords],
  history: ['历史消费记录', viewHistory],
  live: ['实时流水演示', viewLive],
  plan: ['支出规划', viewPlan],
  pots: ['资金分桶', potsView],
  reminders: ['提醒中心', viewReminders],
  identity: ['身份切换', viewIdentity]
};

const EDIT_REMIND_TEXT = '本月你已经修正过几次记录啦，不着急。下次填写时顺手核对一下实际情况就好，真实的小账本会更贴合你的生活节奏。';

function currentRoute() {
  const r = location.hash.replace('#/', '');
  return ROUTES[r] ? r : 'home';
}
function render() {
  const r = currentRoute();
  $('#pageTitle').textContent = ROUTES[r][0];
  $('#view').innerHTML = ROUTES[r][1]();
  document.querySelectorAll('[data-route]').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === r);
  });
  const chip = $('#identityChip');
  chip.textContent = S.identity === 'student' ? '学生身份' : '上班族身份';
  chip.classList.toggle('worker', S.identity === 'worker');
  const n = unreadCount();
  document.querySelectorAll('#remBadge, #remBadgeM').forEach((b) => {
    b.hidden = n === 0;
    b.textContent = n;
  });
  save();
  postRender(r);
  lastRoute = r;
}

/* ---------- motion (07) ---------- */
function countUp(el, from, to, dur, format) {
  if (el._raf) cancelAnimationFrame(el._raf);
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = format(from + (to - from) * e);
    if (p < 1) el._raf = requestAnimationFrame(step); else el._raf = null;
  };
  el._raf = requestAnimationFrame(step);
}
function postRender(r) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (r === 'home' && S.budget && S.survey) {
    const care = $('#homeCare');
    if (care) {
      if (reduce || lastRoute === 'home') care.classList.add('show');
      else setTimeout(() => care.classList.add('show'), 950);
    }
    const big = $('#homeBig'), bar = $('#homeBar');
    if (big && bar && !reduce && lastRoute !== 'home') {
      countUp(big, 0, S.budget - monthSpent(), 900, money0);
      const w = bar.style.width;
      bar.style.transition = 'none'; bar.style.width = '0%';
      void bar.offsetWidth;
      bar.style.transition = '';
      requestAnimationFrame(() => { bar.style.width = w; });
    }
  }
  if (r === 'plan') renderAnchor();
}
let careTimer = null;
function careToast(msg) {
  const t = $('#careToast');
  if (!t) return;
  t.querySelector('span').textContent = msg;
  t.classList.add('show');
  clearTimeout(careTimer);
  careTimer = setTimeout(() => t.classList.remove('show'), 4500);
}
function checkCross(before, after) {
  if (!S.budget) return;
  const crossed = (after >= 80 && before < 80) || (after > 100 && before <= 100);
  if (!crossed) return;
  if (S.thresholdMode === 'now') {
    careToast(after > 100
      ? '本月预算有点满了，我们一起看看接下来怎么安排，没关系的。'
      : '本月消耗进入留意区间，接下来几天留心小额支出就好，不用紧张。');
    const p = $('#homePulse');
    if (p) { p.classList.remove('go'); void p.offsetWidth; p.classList.add('go'); }
  }
}

/* ---------- anchor (06) ---------- */
function renderAnchor() {
  const amtEl = $('#anchorAmt'), sel = $('#anchorUnit');
  if (!amtEl || !sel || !sel.selectedOptions[0]) return;
  const amt = Math.max(0, +amtEl.value || 0);
  const opt = sel.selectedOptions[0];
  const unit = +opt.value, name = opt.dataset.name, ico = opt.dataset.ico;
  const n = Math.round(amt / unit);
  $('#anchorResult').innerHTML = amt > 0
    ? `${money0(amt)} ≈ <b class="num">${n.toLocaleString('zh-CN')}</b> ${esc(name)}`
    : '输入金额后，这里会铺满对应的象形单元。';
  const box = $('#picto');
  box.innerHTML = '';
  if (amt > 0) {
    const show = Math.min(n, 96);
    for (let i = 0; i < show; i++) {
      const d = document.createElement('span');
      d.className = 'pu';
      d.style.animationDelay = Math.min(i * 12, 600) + 'ms';
      d.innerHTML = `<svg><use href="#${ico}"/></svg>`;
      box.appendChild(d);
    }
    if (n > 96) {
      const m = document.createElement('span');
      m.className = 'pu more';
      m.textContent = '+' + (n - 96).toLocaleString('zh-CN');
      box.appendChild(m);
    }
  }
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}
function openModal(html) {
  $('#modalBody').innerHTML = html;
  $('#modalMask').hidden = false;
}
function closeModal() {
  $('#modalMask').hidden = true;
  $('#modalBody').innerHTML = '';
  $('#modalMask .modal').classList.remove('wide');
  confirmCb = null;
  IM = null;
}
function confirmModal(title, body, okLabel, cb, danger) {
  confirmCb = cb;
  openModal(`<h3>${esc(title)}</h3><div class="muted" style="font-size:13.5px">${body}</div>
    <div class="actions">
      <button class="btn ghost" data-action="close-modal">取消</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-action="confirm-ok">${esc(okLabel)}</button>
    </div>`);
}
function openBudgetModal() {
  openModal(`<h3>调整月生活费</h3>
    <form data-form="budget">
      <div class="field"><label>月生活费（元）</label><input name="budget" type="number" min="1" step="1" value="${S.budget || ''}" required></div>
      <div class="actions"><button type="button" class="btn ghost" data-action="close-modal">取消</button>
      <button type="submit" class="btn primary">保存</button></div>
    </form>`);
}

function openConsentModal() {
  openModal(`<h3>授权导入历史消费数据</h3>
    <div class="notice">在你确认之前，我们不会读取任何历史数据。本地版未接入银行后台：授权后会打开导入窗口，由你提供银行导出的流水文件或内容，系统不会编造任何数据。</div>
    ${consentBlockHTML('modal')}`);
}

/* ---------- import window ---------- */
let IM = null;
const IMP_FIELDS = [
  ['date', '交易日期', true],
  ['time', '交易时间', false],
  ['amount', '金额', true],
  ['merchant', '对方户名 / 商户', true],
  ['dir', '收支方向', false],
  ['note', '摘要 / 备注', false],
  ['channel', '交易渠道', false]
];
const pad2 = (n) => String(n).padStart(2, '0');

function openImportModal() {
  if (!S.authorized) { openConsentModal(); return; }
  IM = { step: 1, tab: 'file', encoding: 'utf-8', buf: null, fileName: '', rawText: '', header: null, rows: null, map: null, result: null, sheets: null, sheet: '', isXlsx: false, labeled: false, users: [], userFilter: 'all' };
  renderImport();
}
function renderImport() {
  openModal(importHTML());
  $('#modalMask .modal').classList.add('wide');
}
function parseDelimited(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const first = lines[0];
  const best = ['\t', ',', ';', '|'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0];
  const dl = best[1] > 1 ? best[0] : ',';
  return lines.map((line) => {
    const cells = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === dl) { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}
function autoMap(header) {
  const used = new Set();
  const pick = (res) => {
    for (const re of res) {
      const i = header.findIndex((h, k) => !used.has(k) && re.test(h));
      if (i >= 0) { used.add(i); return i; }
    }
    return -1;
  };
  return {
    date: pick([/交易日期|日期|记账日|date/i, /时间|time/i]),
    time: pick([/交易时间|时间|time/i]),
    amount: pick([/交易金额|金额(?!.*余额)|amount/i, /金额/i]),
    merchant: pick([/对方户名|对方|商户|户名|收款方|merchant/i]),
    dir: pick([/收\/支|收支|方向|借贷|类型/i]),
    note: pick([/摘要|备注|附言|用途/i]),
    channel: pick([/渠道|方式/i])
  };
}
function impDecode() {
  let text;
  try { text = new TextDecoder(IM.encoding === 'gbk' ? 'gbk' : 'utf-8').decode(IM.buf); }
  catch (e) { text = new TextDecoder('utf-8').decode(IM.buf); }
  impParseText(text);
}
function impParseText(text) {
  impParseRows(parseDelimited(text));
}
function impParseRows(rows) {
  if (!rows.length) { toast('没有识别到可解析的内容'); return; }
  const hi = rows.findIndex((r) => r.filter((c) => /日期|时间|金额|户名|商户|摘要|渠道|收支|余额|置信|date|amount/i.test(String(c))).length >= 2);
  if (hi >= 0) { IM.header = rows[hi].map(String); IM.rows = rows.slice(hi + 1); }
  else { IM.header = rows[0].map((_, i) => `第 ${i + 1} 列`); IM.rows = rows; }
  IM.map = autoMap(IM.header);
  IM.labeled = IM.header.some((h) => /一级分类/.test(h)) && IM.header.some((h) => /置信依据|处理策略/.test(h));
  IM.users = [];
  IM.userFilter = 'all';
  if (IM.labeled) {
    IM.map.tier = IM.header.findIndex((h) => /一级分类/.test(h));
    IM.map.basis = IM.header.findIndex((h) => /置信依据/.test(h));
    IM.map.sub = IM.header.findIndex((h) => /二级分类/.test(h));
    IM.map.guessCol = IM.header.findIndex((h) => /猜测分类/.test(h));
    IM.map.user = IM.header.findIndex((h) => /用户ID|用户/.test(h));
    if (IM.map.user >= 0) IM.users = [...new Set(IM.rows.map((r) => String(r[IM.map.user] || '')).filter(Boolean))];
  }
  IM.step = 2;
  renderImport();
}
function impReadFile(file) {
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { toast('文件过大（限 8MB），请拆分后导入'); return; }
  IM.fileName = file.name;
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    file.arrayBuffer().then((buf) => {
      try {
        const wb = XLSX.read(buf, { type: 'array' });
        IM.sheets = {};
        wb.SheetNames.forEach((n) => {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' });
          if (rows.length) IM.sheets[n] = rows;
        });
        const names = Object.keys(IM.sheets);
        if (!names.length) { toast('Excel 中没有读到数据'); return; }
        IM.isXlsx = true;
        IM.sheet = names.slice().sort((a, b) => sheetScore(b) - sheetScore(a))[0];
        impUseSheet();
      } catch (e) { toast('Excel 解析失败，请尝试另存为 CSV 后导入'); }
    });
    return;
  }
  file.arrayBuffer().then((buf) => { IM.buf = buf; impDecode(); });
}
function sheetScore(name) {
  const head = IM.sheets[name].slice(0, 3).flat().join(' ');
  return (head.match(/日期|时间|金额|商户|户名|收支|交易|置信/g) || []).length;
}
function impUseSheet() {
  impParseRows(IM.sheets[IM.sheet]);
}
function normDate(s) {
  if (!s) return null;
  const str = String(s).trim();
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const n = +str;
    if (n > 20000 && n < 60000) {
      const d = new Date(Math.round((n - 25569) * 86400000));
      return { date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`, time: '' };
    }
  }
  let m = str.match(/(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/);
  if (!m) { const m2 = str.match(/(\d{4})(\d{2})(\d{2})/); if (m2) m = m2; }
  if (!m) return null;
  const mo = +m[2], da = +m[3];
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  const t = str.match(/(\d{1,2}):(\d{2})/);
  return { date: `${m[1]}-${pad2(mo)}-${pad2(da)}`, time: t ? `${pad2(t[1])}:${t[2]}` : '' };
}
const LAB_CAT = { 餐饮: 'food', 交通: 'transport', 学业: 'study', 学习: 'study', 生活: 'daily', 零售: 'daily', 日用: 'daily', 服饰: 'daily', 形象: 'daily', 通讯: 'other', 效率: 'fun', 兴趣: 'fun', 娱乐: 'fun', 数码: 'other' };
const labCat = (s) => LAB_CAT[String(s).split('-')[0]] || 'other';
const TIER_TAG = { high: ['ok', '高置信'], mid: ['warn', '中置信'], low: ['mute', '低置信'] };
function impBuild() {
  const m = IM.map, out = [], skipped = [];
  const seen = new Set(S.records.map((r) => `${r.date}|${r.time || ''}|${r.merchant}|${r.amount}|${r.user || ''}`));
  const rows = IM.labeled && IM.userFilter !== 'all' && m.user >= 0
    ? IM.rows.filter((r) => String(r[m.user] || '') === IM.userFilter)
    : IM.rows;
  rows.forEach((row, i) => {
    const fail = (why) => skipped.push({ line: i + 1, why });
    const d = normDate(row[m.date]);
    if (!d) return fail('日期无法识别');
    let time = d.time;
    if (!time && m.time >= 0) {
      const t = String(row[m.time] || '').match(/(\d{1,2}):(\d{2})/);
      if (t) time = pad2(t[1]) + ':' + t[2];
    }
    if (m.dir >= 0) {
      const v = String(row[m.dir] || '');
      if (/收|入|贷|退/.test(v) && !/支/.test(v)) return fail('收入 / 退款行');
      if (!/支|借|出|付/.test(v)) return fail('收支方向不明');
    }
    let amt = Number(String(row[m.amount] || '').replace(/[¥￥,，\s元]/g, ''));
    if (!isFinite(amt) || amt === 0) return fail('金额无效');
    amt = Math.abs(Math.round(amt * 100) / 100);
    let merchant = String(row[m.merchant] || '').trim();
    const note = !IM.labeled && m.note >= 0 ? String(row[m.note] || '').trim() : '';
    if (!merchant) merchant = note;
    else if (note && !merchant.includes(note)) merchant = (merchant + '·' + note).slice(0, 60);
    if (!merchant) return fail('缺少商户名');
    const user = IM.labeled && m.user >= 0 ? String(row[m.user] || '') : '';
    let lab = null;
    if (IM.labeled) {
      const tv = String(row[m.tier] || '');
      const tier = /高/.test(tv) ? 'high' : /中/.test(tv) ? 'mid' : /低/.test(tv) ? 'low' : null;
      if (!tier) return fail('缺少置信度标注');
      const basis = m.basis >= 0 ? String(row[m.basis] || '').trim() : '';
      if (tier === 'high') {
        lab = { tier, cat: labCat(row[m.sub]), reason: basis || '预标注直接归类' };
      } else if (tier === 'mid') {
        const g = m.guessCol >= 0 ? String(row[m.guessCol] || '').trim() : '';
        lab = { tier, guess: labCat(g), guessLabel: g.includes('-') ? g.split('-').slice(1).join('-') : (g || '待确认'), reason: basis || '聚合收单预标注' };
      } else {
        lab = { tier, reason: basis || '预标注未分类' };
      }
    }
    const key = `${d.date}|${time}|${merchant}|${amt}|${user}`;
    if (seen.has(key)) return fail('与已有记录重复');
    seen.add(key);
    out.push({ date: d.date, time, merchant, amount: amt, user, lab });
  });
  out.sort((a, b) => a.date.localeCompare(b.date));
  return { out, skipped };
}
function impMissing() {
  return IMP_FIELDS.filter(([k, , req]) => req && IM.map[k] < 0).map(([, l]) => l);
}
function importHTML() {
  if (IM.step === 1) return `
    <h3>导入历史消费记录</h3>
    <p class="dim mb">数据只来自你提供的文件或粘贴内容，仅存本机浏览器；系统不会编造任何记录。支持逗号 / 制表符 / 分号分隔，首行表头会自动识别。</p>
    <div class="toolbar mb">
      <div class="seg">
        <button data-action="imp-tab" data-v="file" class="${IM.tab === 'file' ? 'on' : ''}">上传文件</button>
        <button data-action="imp-tab" data-v="paste" class="${IM.tab === 'paste' ? 'on' : ''}">粘贴文本</button>
      </div>
      <div class="field" style="margin:0;flex-direction:row;align-items:center;gap:8px">
        <label style="white-space:nowrap">文件编码</label>
        <select data-change="imp-encoding" class="inline-select">
          <option value="utf-8" ${IM.encoding === 'utf-8' ? 'selected' : ''}>UTF-8</option>
          <option value="gbk" ${IM.encoding === 'gbk' ? 'selected' : ''}>GBK（常见银行导出）</option>
        </select>
      </div>
    </div>
    ${IM.tab === 'file' ? `
    <label class="dropzone" id="impDrop">
      <input type="file" id="impFile" accept=".csv,.txt,.tsv,.xlsx,.xls" hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
      <b>点击选择文件，或拖拽到这里</b>
      <span>支持 Excel（.xlsx / .xls）与银行导出的 CSV / TXT 流水 · 自动选择明细工作表、识别列；含置信度预标注的训练数据会按标注入库，无需手动识别</span>
    </label>` : `
    <textarea id="impPaste" class="imp-textarea" rows="8" placeholder="粘贴银行流水文本，例如：&#10;交易日期,交易时间,金额,对方户名,摘要,交易渠道,收/支&#10;2026-10-03,15:20,18.00,财付通-美团,外卖,快捷支付,支">${esc(IM.rawText)}</textarea>
    <div class="mt"><button class="btn primary" data-action="imp-parse-paste">解析粘贴内容</button></div>`}
    <p class="dim mt">导入前会先展示列映射与预览，确认后才写入；与已有记录重复的行会自动跳过。</p>`;

  if (IM.step === 2) {
    const { out, skipped } = impBuild();
    const missing = impMissing();
    const opts = (sel) => `<option value="-1">不使用</option>` + IM.header.map((h, i) =>
      `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(h)}</option>`).join('');
    const sheetNames = IM.sheets ? Object.keys(IM.sheets) : [];
    return `
    <h3>确认列映射与预览</h3>
    <p class="dim mb">来源：${esc(IM.fileName || '粘贴内容')} · 共 ${IM.rows.length} 行数据。带 * 为必需列；映射改动会实时刷新预览。</p>
    ${sheetNames.length > 1 ? `
    <div class="field" style="max-width:320px"><label>工作表（已自动选择明细表）</label>
      <select data-change="imp-sheet">${sheetNames.map((n) => `<option value="${esc(n)}" ${n === IM.sheet ? 'selected' : ''}>${esc(n)}（${IM.sheets[n].length} 行）</option>`).join('')}</select>
    </div>` : ''}
    ${IM.labeled ? `
    <div class="notice mb">已识别<strong>置信度预标注数据</strong>：将按文件中的高 / 中 / 低置信标注与置信依据直接入库，不再重新判断；收入行自动跳过。中置信按「猜测分类」攒组，供月末批量确认。</div>
    ${IM.users.length > 1 ? `
    <div class="field" style="max-width:320px"><label>导入哪些用户（共 ${IM.users.length} 位）</label>
      <select data-change="imp-user">
        <option value="all" ${IM.userFilter === 'all' ? 'selected' : ''}>全部用户（${IM.users.length} 位）</option>
        ${IM.users.map((u) => `<option value="${esc(u)}" ${IM.userFilter === u ? 'selected' : ''}>仅 ${esc(u)}</option>`).join('')}
      </select>
    </div>` : ''}` : ''}
    <div class="imp-map">${IMP_FIELDS.map(([k, label, req]) => `
      <div class="field"><label>${label}${req ? ' *' : ''}</label>
        <select data-change="imp-map" data-field="${k}">${opts(IM.map[k])}</select></div>`).join('')}
    </div>
    ${missing.length ? `<div class="notice rose">还缺必需列：${missing.join('、')}。请在上方选择对应列。</div>` : `
    <div class="stat-line">
      <div><b>${out.length}</b><span>可导入支出</span></div>
      <div><b>${money(out.reduce((s, r) => s + r.amount, 0))}</b><span>合计金额</span></div>
      <div><b>${skipped.length}</b><span>跳过行数</span></div>
    </div>
    ${out.length ? `<div class="imp-preview"><table>
      <thead><tr><th>日期</th><th>时间</th>${IM.users.length ? '<th>用户</th>' : ''}<th>商户 / 用途</th>${IM.labeled ? '<th>置信度</th>' : ''}<th style="text-align:right">金额</th></tr></thead>
      <tbody>${out.slice(0, 6).map((r) => `<tr><td>${r.date}</td><td>${r.time || '—'}</td>${IM.users.length ? `<td>${esc(r.user || '—')}</td>` : ''}<td>${esc(r.merchant)}</td>${IM.labeled ? `<td><span class="tag ${TIER_TAG[r.lab.tier][0]}">${TIER_TAG[r.lab.tier][1]}</span></td>` : ''}<td class="num" style="text-align:right">${money(r.amount)}</td></tr>`).join('')}</tbody>
    </table>${out.length > 6 ? `<p class="dim" style="padding:6px 10px">… 其余 ${out.length - 6} 笔导入后可在「历史消费记录」查看</p>` : ''}</div>` : '<div class="empty">当前映射下没有可导入的支出行</div>'}
    ${skipped.length ? `<p class="dim mt">跳过原因示例：${skipped.slice(0, 3).map((s) => `第 ${s.line} 行 · ${s.why}`).join('；')}${skipped.length > 3 ? ' …' : ''}</p>` : ''}`}
    <div class="actions">
      <button class="btn ghost" data-action="imp-back">返回重选</button>
      <button class="btn primary" data-action="imp-run" ${missing.length || !out.length ? 'disabled' : ''}>确认导入 ${out.length} 笔</button>
    </div>`;
  }

  const r = IM.result;
  const zone = (cls, title, n, sum, desc) => n ? `
    <div class="zone ${cls}"><div class="zh">${title} · ${n} 笔 / ${money(sum)}</div><p>${desc}</p></div>` : '';
  return `
    <h3>导入完成，消费已初步归类</h3>
    <p class="dim mb">以下结果完全来自你刚导入的 ${r.total} 笔流水，没有添加任何其他数据。</p>
    ${flowSteps(3)}
    ${zone('high', '高置信 · 已直接归类，无需确认', r.high, r.highSum, '品牌商户、校园场景、固定订阅、公交地铁等规则直接命中。')}
    ${zone('mid', '中置信 · 已攒成组，等你一次确认', r.mid, r.midSum, '聚合收单按金额带 + 时间带初步判断；在「消费记录」批量确认，不逐笔打扰。')}
    ${zone('low', '低置信 · 放入未分类池', r.low, r.lowSum, '只做汇总展示，不参与统计与任何建议，避免算错；可手动归类后计入。')}
    ${r.skipped ? `<p class="dim">另有 ${r.skipped} 行被跳过（收入 / 退款、日期或金额无法识别、与已有记录重复等）。</p>` : ''}
    <div class="actions">
      ${r.mid ? '<button class="btn primary" data-action="imp-goto" data-to="records">去批量确认</button>' : ''}
      ${r.low ? `<button class="btn" data-action="imp-goto" data-to="records">查看未分类池</button>` : ''}
      <button class="btn ${r.mid || r.low ? 'ghost' : 'primary'}" data-action="imp-done">完成</button>
    </div>`;
}

function catOptions(selected) {
  return CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.name}</option>`).join('');
}
function catChip(r, clickable) {
  const c = catOf(r.cat);
  return `<span class="chip ${clickable ? 'clickable' : ''}" ${clickable ? `data-action="edit-record" data-id="${r.id}" title="点击修改这条记录"` : ''}>
    <span class="dot" style="background:${c.color}"></span>${c.name}${r.corrected ? ' · 已修正' : ''}</span>`;
}
function donutSVG(entries, total) {
  const R = 15.9155;
  let off = 25;
  const circles = entries.map(([id, val]) => {
    const pct = (val / total) * 100;
    const el = `<circle r="${R}" cx="21" cy="21" fill="none" stroke="${catOf(id).color}" stroke-width="6.5"
      stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${off}"></circle>`;
    off -= pct;
    return el;
  }).join('');
  return `<svg viewBox="0 0 42 42"><circle r="${R}" cx="21" cy="21" fill="none" stroke="#e3edf9" stroke-width="6.5"></circle>${circles}
    <text x="21" y="20.4" text-anchor="middle" font-size="5.4" font-weight="700" fill="#0b2545">${money0(total)}</text>
    <text x="21" y="25.6" text-anchor="middle" font-size="3.1" fill="#7089a6">本月累计</text></svg>`;
}

/* ---------- AI 猜分类 ---------- */
let aiConsentCb = null;

function askAiConsent(kind, cb) {
  if (!S.aiConsent) S.aiConsent = {};
  if (S.aiConsent[kind]) { cb(); return; }
  aiConsentCb = cb;
  const n = Math.min(poolLow().length, 40);
  openModal(`<h3>AI 猜分类前，先说清楚</h3>
    <p class="muted" style="font-size:13.5px">会把这 ${n} 笔未分类记录的<strong>商户名、金额、时间</strong>发送给 AI 服务（通义千问）推断分类。结果只是建议，点「采纳」后才计入统计。</p>
    <p class="dim mt">这是一次性授权，之后不再询问；其余数据仍然只存在这台设备的浏览器里。</p>
    <label class="check-line"><input type="checkbox" id="aiConsentBox"> 我了解并同意发送上述内容</label>
    <div class="actions">
      <button class="btn ghost" data-action="close-modal">取消</button>
      <button class="btn primary" data-action="ai-consent-ok" data-kind="${kind}">同意并继续</button>
    </div>`);
}

function runAiClassify() {
  const pool = poolLow();
  if (!pool.length) return toast('未分类池是空的');
  if (AI.busy) return;
  askAiConsent('classify', async () => {
    AI.busy = true;
    const btn = document.querySelector('[data-action="ai-classify-pool"]');
    if (btn) { btn.disabled = true; btn.textContent = 'AI 正在判断…'; }
    try {
      const items = pool.slice(0, 40).map((r) => ({
        id: r.id, merchant: r.merchant, amount: r.amount, time: r.time || '', date: r.date
      }));
      const out = await AI.classify(items);
      let n = 0;
      (out.results || []).forEach((s) => { if (s && s.id) { AI.setSugg(s.id, s); n++; } });
      render();
      toast(n ? `AI 给出 ${n} 条建议：逐条采纳后才计入统计` : 'AI 这次没有给出建议');
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'AI 猜分类'; }
      toast('AI 暂时不可用：' + e.message);
    } finally {
      AI.busy = false;
    }
  });
}

function adoptAiSuggestion(id) {
  const r = S.records.find((x) => x.id === id);
  const s = AI.sugg(id);
  if (!r || !s) return;
  const before = pctNow();
  Object.assign(r, {
    cat: s.cat,
    guess: s.cat,
    guessLabel: 'AI 建议 · 你确认',
    tier: 'manual',
    confirmed: true,
    corrected: true,
    reason: 'AI 建议（你确认）'
  });
  AI.dropSugg(id);
  save(); render();
  toast(`已采纳，归入${catOf(s.cat).name}，计入统计`);
  checkCross(before, pctNow());
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  const id = t.dataset.id;
  if (a === 'close-modal') return closeModal();
  if (a === 'confirm-ok') { const cb = confirmCb; closeModal(); if (cb) cb(); return; }

  if (a === 'sv-opt') {
    const block = t.closest('.q-block');
    SV.a[t.dataset.q] = t.dataset.v;
    block.querySelectorAll('.q-opt').forEach((x) => x.classList.toggle('on', x === t));
    svSync();
    return;
  }
  if (a === 'sv-next') {
    if (t.disabled) return;
    if (SV.step < QUESTIONS.length - 1) { SV.step++; render(); } else applySurvey();
    return;
  }
  if (a === 'sv-prev') { if (SV.step > 0) { SV.step--; render(); } return; }
  if (a === 'sv-skip') {
    S.survey = { done: false, skipped: true };
    SV = null;
    save(); render(); toast('已跳过问卷：数据完全由你填写');
    return;
  }
  if (a === 'sv-reset') { svInit(null); render(); return; }
  if (a === 'retake-survey') {
    svInit(S.survey);
    S.survey = null;
    save();
    location.hash = '#/home';
    render();
    return;
  }
  if (a === 'record-view') { recordView = t.dataset.v; render(); return; }

  if (a === 'ai-classify-pool') { runAiClassify(); return; }
  if (a === 'ai-adopt') { adoptAiSuggestion(id); return; }
  if (a === 'ai-consent-ok') {
    const box = $('#aiConsentBox');
    if (!box || !box.checked) return toast('请先勾选同意');
    if (!S.aiConsent) S.aiConsent = {};
    S.aiConsent[t.dataset.kind] = true;
    save();
    const cb = aiConsentCb;
    aiConsentCb = null;
    closeModal();
    if (cb) cb();
    return;
  }

  if (a === 'add-setup-row') { $('#setupRows').insertAdjacentHTML('beforeend', setupRowHTML()); return; }
  if (a === 'del-setup-row') { t.closest('.setup-row').remove(); return; }
  if (a === 'edit-budget') { openBudgetModal(); return; }
  if (a === 'choose-scheme') {
    const scheme = t.dataset.scheme;
    if (scheme === 'A') { openConsentModal(); return; }
    if (scheme === S.scheme) return toast('当前已在使用该方案');
    confirmModal('切换为从零积累', '切换后仅保留你手动填写的记录，系统从此刻起逐步学习你的消费习惯；如曾授权历史数据，将停止使用。', '切换方案', () => {
      S.scheme = 'B';
      S.authorized = false;
      save(); render(); toast('已切换为从零积累数据');
    });
    return;
  }
  if (a === 'do-auth') {
    const cb = $('#modalBody [data-consent-scope] input[data-change="auth-consent"]');
    if (!cb || !cb.checked) return toast('请先勾选同意授权');
    S.scheme = 'A'; S.authorized = true;
    save(); closeModal(); render();
    openImportModal();
    return;
  }
  if (a === 'onboard-agree') {
    const scope = t.closest('[data-consent-scope]');
    if (!scope.querySelector('input[data-change="auth-consent"]').checked) return toast('请先勾选同意授权');
    S.scheme = 'A'; S.authorized = true;
    save(); render();
    openImportModal();
    return;
  }
  if (a === 'onboard-decline') {
    S.scheme = 'B'; S.authorized = false;
    save(); render();
    careToast('没问题，我们先从今天开始记录。随时可以在「授权与隐私」开启授权，我们不会反复提示。');
    return;
  }
  if (a === 'open-import') { openImportModal(); return; }
  if (a === 'imp-tab') { IM.tab = t.dataset.v; renderImport(); return; }
  if (a === 'imp-parse-paste') {
    if (!IM.rawText.trim()) return toast('请先粘贴流水文本');
    impParseText(IM.rawText);
    return;
  }
  if (a === 'imp-back') { IM.step = 1; renderImport(); return; }
  if (a === 'imp-run') {
    const { out, skipped } = impBuild();
    if (!out.length) return toast('没有可导入的支出行');
    const before = pctNow();
    const res = { high: 0, mid: 0, low: 0, highSum: 0, midSum: 0, lowSum: 0 };
    out.forEach((r) => {
      const c = r.lab
        ? (r.lab.tier === 'high'
          ? { tier: 'high', cat: r.lab.cat, guess: r.lab.cat, guessLabel: r.lab.reason, confirmed: true, reason: r.lab.reason }
          : r.lab.tier === 'mid'
            ? { tier: 'mid', cat: null, guess: r.lab.guess, guessLabel: r.lab.guessLabel, confirmed: false, reason: r.lab.reason }
            : { tier: 'low', cat: null, guess: null, guessLabel: null, confirmed: false, reason: r.lab.reason })
        : classify(r.merchant, r.amount, r.time, S.records);
      const rec = { id: uid(), src: 'import', date: r.date, time: r.time, merchant: r.merchant, amount: r.amount, ...c };
      if (r.user) rec.user = r.user;
      S.records.push(rec);
      res[c.tier]++; res[c.tier + 'Sum'] += r.amount;
    });
    S.lastImport = { ts: today(), file: IM.fileName || '粘贴内容', total: out.length, high: res.high, mid: res.mid, low: res.low, skipped: skipped.length };
    IM.result = { ...res, total: out.length, skipped: skipped.length };
    IM.step = 3;
    save(); renderImport(); render();
    checkCross(before, pctNow());
    return;
  }
  if (a === 'imp-goto') {
    const to = t.dataset.to;
    closeModal();
    if (location.hash === '#/' + to) render(); else location.hash = '#/' + to;
    return;
  }
  if (a === 'imp-done') { closeModal(); render(); return; }
  if (a === 'revoke-auth') {
    const n = S.records.filter((r) => r.src === 'import').length;
    openModal(`<h3>撤回授权</h3>
      <p class="muted" style="font-size:13.5px">撤回后停止使用历史数据授权，可随时重新授权。</p>
      ${n ? `<label class="check-line"><input type="checkbox" id="revokePurge" checked>同时删除已导入的 ${n} 笔历史流水（手动填写的记录始终保留）</label>`
        : '<p class="dim mt">当前没有已导入的历史流水；手动填写的记录不受影响。</p>'}
      <div class="actions"><button class="btn ghost" data-action="close-modal">取消</button>
      <button class="btn danger" data-action="do-revoke">撤回授权</button></div>`);
    return;
  }
  if (a === 'do-revoke') {
    const purge = $('#revokePurge') && $('#revokePurge').checked;
    if (purge) S.records = S.records.filter((r) => r.src !== 'import');
    S.authorized = false; S.scheme = 'B'; S.lastImport = null;
    save(); closeModal(); render();
    toast(purge ? '已撤回授权，导入的历史流水已删除' : '已撤回授权');
    return;
  }
  if (a === 'edit-record') {
    const r = S.records.find((x) => x.id === id);
    if (!r) return;
    openModal(`<h3>修改消费记录</h3>
      <form data-form="edit-record">
        <input type="hidden" name="id" value="${r.id}">
        <div class="field"><label>商户 / 用途</label><input name="merchant" required maxlength="30" value="${esc(r.merchant)}"></div>
        <div class="form-grid">
          <div class="field"><label>金额（元）</label><input name="amount" type="number" min="0.01" step="0.01" required value="${r.amount}"></div>
          <div class="field"><label>日期</label><input name="date" type="date" value="${r.date}" required></div>
        </div>
        <div class="form-grid">
          <div class="field"><label>时间（可选）</label><input name="time" type="time" value="${r.time || ''}"></div>
          <div class="field"><label>分类</label><select name="cat"><option value="auto">重新自动判断</option>${catOptions(r.cat)}</select></div>
        </div>
        <div class="actions"><button type="button" class="btn ghost" data-action="close-modal">取消</button>
        <button type="submit" class="btn primary">保存修改</button></div>
      </form>`);
    return;
  }
  if (a === 'edit-remind-off') {
    S.editRemindOff = true;
    save(); closeModal(); render(); toast('已关闭修改提醒，可在提醒中心重新开启');
    return;
  }
  if (a === 'edit-remind-on') {
    S.editRemindOff = false;
    save(); render(); toast('已重新开启修改提醒');
    return;
  }
  if (a === 'reset-month') {
    confirmModal('清空本月数据', '将清空本月的消费记录、到账登记与修改计数；其他月份数据、预算与授权设置不受影响。', '清空本月', () => {
      const mk = today().slice(0, 7);
      S.records = S.records.filter((r) => !r.date.startsWith(mk));
      S.deposits = S.deposits.filter((d) => !d.date.startsWith(mk));
      S.edits[mk] = 0;
      save(); render(); toast('本月数据已清空');
    }, true);
    return;
  }
  if (a === 'add-record') {
    openModal(`<h3>记一笔消费</h3>
      <form data-form="record">
        <div class="field"><label>商户 / 用途</label><input name="merchant" required maxlength="30" placeholder="如：美团·午餐"></div>
        <div class="form-grid">
          <div class="field"><label>金额（元）</label><input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"></div>
          <div class="field"><label>日期</label><input name="date" type="date" value="${today()}" required></div>
        </div>
        <div class="form-grid">
          <div class="field"><label>时间（可选，用于时间带判断）</label><input name="time" type="time"></div>
          <div class="field"><label>分类</label><select name="cat"><option value="auto" selected>自动判断（推荐）</option>${catOptions(null)}</select></div>
        </div>
        <p class="dim">自动判断：高置信直接归类；聚合收单按金额带+时间带猜测、攒起来批量确认；异常/乱码/陌生商户进未分类池。</p>
        <div class="actions"><button type="button" class="btn ghost" data-action="close-modal">取消</button>
        <button type="submit" class="btn primary">保存记录</button></div>
      </form>`);
    return;
  }
  if (a === 'confirm-group') {
    const before = pctNow();
    const [guess, label] = t.dataset.key.split('|');
    const items = pendingMid().filter((r) => r.guess === guess && r.guessLabel === label);
    items.forEach((r) => { r.cat = r.guess; r.confirmed = true; });
    items.forEach(potsOnSpend);
    save(); render(); toast(`已确认 ${items.length} 笔归类为${catOf(guess).name}`);
    checkCross(before, pctNow());
    return;
  }
  if (a === 'filter-range') { recordFilter.range = Number(t.dataset.range); render(); return; }
  if (a === 'filter-cat') { recordFilter.cat = t.dataset.cat; render(); return; }
  if (a === 'register-plan') {
    if (!pendingPlan) return;
    S.plans.push({ id: uid(), ...pendingPlan, createdAt: today() });
    pendingPlan = null;
    save(); render(); toast('计划已登记，建议仅供参考');
    return;
  }
  if (a === 'drop-plan') { pendingPlan = null; render(); return; }
  if (a === 'delete-plan') {
    S.plans = S.plans.filter((p) => p.id !== id);
    save(); render(); toast('计划已删除');
    return;
  }
  if (a === 'add-deposit') {
    openModal(`<h3>登记一笔大额到账</h3>
      <form data-form="deposit">
        <div class="field"><label>来源 / 用途</label><input name="label" required maxlength="30" placeholder="如：奖学金"></div>
        <div class="form-grid">
          <div class="field"><label>金额（元）</label><input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"></div>
          <div class="field"><label>到账日期</label><input name="date" type="date" value="${today()}" required></div>
        </div>
        <div class="actions"><button type="button" class="btn ghost" data-action="close-modal">取消</button>
        <button type="submit" class="btn primary">登记</button></div>
      </form>`);
    return;
  }
  if (a === 'read-reminder') {
    S.readRem[id] = true; save(); render();
    return;
  }
  if (a === 'read-all') {
    visibleReminders().forEach((m) => { S.readRem[m.id] = true; });
    save(); render(); toast('全部标记为已读');
    return;
  }
  if (a === 'switch-identity') {
    confirmModal('切换为上班族身份', '切换后将新增收入规划能力，并强化理财推荐服务（理财内容仍仅在你主动订阅后推送）。已有填写数据与授权状态不受影响。', '确认切换', () => {
      S.identity = 'worker'; S.workerSince = today(); save(); render(); toast('已切换为上班族身份，收入规划与资金分桶已解锁');
    });
    return;
  }
  if (a === 'switch-back') {
    confirmModal('切回学生身份', '切回后将隐藏收入规划模块，理财推荐恢复弱化处理。填写数据与授权不受影响。', '切回学生', () => {
      S.identity = 'student'; save(); render(); toast('已切回学生身份');
    });
    return;
  }
  if (a === 'reset-demo') {
    confirmModal('清空全部数据', '将清空本机浏览器中你填写的全部数据（预算、记录、计划、问卷、订阅设置），回到空白首页。', '清空', resetDemo, true);
    return;
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'impFile') { impReadFile(e.target.files[0]); return; }
  const t = e.target.closest('[data-change]');
  if (!t) return;
  const a = t.dataset.change;
  if (a === 'auth-consent') {
    const scope = t.closest('[data-consent-scope]');
    scope.querySelector('.auth-disclosure').hidden = !t.checked;
    scope.querySelector('.auth-agree').disabled = !t.checked;
    return;
  }
  if (a === 'imp-encoding') {
    IM.encoding = t.value;
    if (IM.buf) impDecode();
    return;
  }
  if (a === 'imp-map') { IM.map[t.dataset.field] = Number(t.value); renderImport(); return; }
  if (a === 'imp-sheet') { IM.sheet = t.value; impUseSheet(); return; }
  if (a === 'imp-user') { IM.userFilter = t.value; renderImport(); return; }
  if (a === 'wealth') {
    S.wealthOptIn = t.checked;
    save(); render();
    toast(t.checked ? '已订阅：登记大额到账后将展示理财建议' : '已关闭理财建议推送');
  }
  if (a === 'freq') {
    S.reminderFreq = t.value; save(); render(); toast('提醒频率已更新');
  }
  if (a === 'threshold-mode') {
    S.thresholdMode = t.value; save(); render(); toast('提醒时机已更新');
  }
  if (a === 'anchor-unit') { anchorUnit = t.value; renderAnchor(); }
  if (a === 'search') { recordFilter.q = t.value.trim(); render(); }
  if (a === 'history-month') { historyMonth = t.value; render(); }
  if (a === 'regroup') {
    const before = pctNow();
    const [guess, label] = t.dataset.key.split('|');
    const items = pendingMid().filter((r) => r.guess === guess && r.guessLabel === label);
    items.forEach((r) => { r.cat = t.value; r.confirmed = true; r.corrected = true; });
    items.forEach(potsOnSpend);
    save(); render(); toast(`已将该组 ${items.length} 笔改判为${catOf(t.value).name}`);
    checkCross(before, pctNow());
  }
  if (a === 'pool-cat') {
    const before = pctNow();
    const r = S.records.find((x) => x.id === t.dataset.id);
    if (!t.value) return;
    r.cat = t.value; r.confirmed = true; r.corrected = true;
    potsOnSpend(r);
    save(); render(); toast('已手动归类，计入统计');
    checkCross(before, pctNow());
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'anchorAmt') renderAnchor();
  if (e.target.id === 'impPaste' && IM) IM.rawText = e.target.value;
});

document.addEventListener('dragover', (e) => {
  const dz = e.target.closest && e.target.closest('#impDrop');
  if (!dz) return;
  e.preventDefault();
  dz.classList.add('over');
});
document.addEventListener('dragleave', (e) => {
  const dz = e.target.closest && e.target.closest('#impDrop');
  if (dz) dz.classList.remove('over');
});
document.addEventListener('drop', (e) => {
  const dz = e.target.closest && e.target.closest('#impDrop');
  if (!dz) return;
  e.preventDefault();
  dz.classList.remove('over');
  if (IM) impReadFile(e.dataTransfer.files[0]);
});

document.addEventListener('mouseover', (e) => {
  const c = e.target.closest('.heat-cell');
  if (!c || c.classList.contains('empty')) return;
  const host = $('#heatHost'), tip = $('#heatTip');
  if (!host || !tip) return;
  const d = heatData().map[c.dataset.date];
  const items = d.items.slice(0, 3).map((r) => esc(r.merchant) + ' ' + money(r.amount)).join('；');
  tip.innerHTML = `${c.dataset.date}<br><b>${d.sum ? money(d.sum) : '¥0 · 零消费'}</b>${items ? '<br>' + items : ''}`;
  const hr = host.getBoundingClientRect(), cr = c.getBoundingClientRect();
  tip.style.left = (cr.left - hr.left + cr.width / 2) + 'px';
  tip.style.top = (cr.top - hr.top) + 'px';
  tip.classList.add('show');
});
document.addEventListener('mouseout', (e) => {
  if (e.target.closest('.heat-cell')) { const tip = $('#heatTip'); if (tip) tip.classList.remove('show'); }
});

document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  const fd = new FormData(f);
  const kind = f.dataset.form;
  if (kind === 'setup') {
    const budget = Number(fd.get('budget'));
    if (!(budget > 0)) return toast('请填写有效的月生活费');
    const rows = [...f.querySelectorAll('.setup-row')];
    const added = [];
    for (const row of rows) {
      const merchant = row.querySelector('[name="merchant"]').value.trim();
      const amount = Number(row.querySelector('[name="amount"]').value);
      const date = row.querySelector('[name="date"]').value;
      const time = row.querySelector('[name="time"]').value;
      const catVal = row.querySelector('[name="cat"]').value;
      if (!merchant && !amount) continue;
      if (!merchant || !(amount > 0) || !date) return toast('请补全支出行的商户、金额与日期');
      const c = catVal === 'auto' ? classify(merchant, amount, time, S.records) : { tier: 'manual', cat: catVal, guess: catVal, guessLabel: '手动指定', confirmed: true, reason: '手动指定' };
      added.push({ id: uid(), date, time, merchant, amount, ...c });
    }
    S.budget = budget;
    S.records.push(...added);
    added.filter(isClassified).forEach(potsOnSpend);
    if (!S.scheme) S.scheme = 'B';
    save(); render(); toast(`已保存：月生活费 ${money0(budget)}，录入 ${added.length} 笔支出`);
    return;
  }
  if (kind === 'budget') {
    S.budget = Number(fd.get('budget'));
    save(); closeModal(); render(); toast('月生活费已更新');
    return;
  }
  if (kind === 'record') {
    const before = pctNow();
    const merchant = fd.get('merchant').trim();
    const amount = Number(fd.get('amount'));
    const catVal = fd.get('cat');
    const c = catVal === 'auto'
      ? classify(merchant, amount, fd.get('time'), S.records)
      : { tier: 'manual', cat: catVal, guess: catVal, guessLabel: '手动指定', confirmed: true, reason: '手动指定' };
    const rec = { id: uid(), date: fd.get('date'), time: fd.get('time'), merchant, amount, ...c };
    S.records.unshift(rec);
    if (c.confirmed) potsOnSpend(rec);
    save(); closeModal(); render();
    toast(c.tier === 'high' ? `已直接归类为${catOf(c.cat).name}（${c.reason}）` : c.tier === 'mid' ? `已记录：猜为${c.guessLabel}，待批量确认` : '已记录：进入未分类池，仅汇总展示');
    checkCross(before, pctNow());
    return;
  }
  if (kind === 'edit-record') {
    const before = pctNow();
    const r = S.records.find((x) => x.id === fd.get('id'));
    if (!r) return;
    const merchant = fd.get('merchant').trim();
    const amount = Number(fd.get('amount'));
    const catVal = fd.get('cat');
    const c = catVal === 'auto'
      ? classify(merchant, amount, fd.get('time'), S.records.filter((x) => x.id !== r.id))
      : { tier: 'manual', cat: catVal, guess: catVal, guessLabel: '手动指定', confirmed: true, reason: '手动指定' };
    Object.assign(r, { merchant, amount, date: fd.get('date'), time: fd.get('time'), ...c, corrected: true });
    const mk = today().slice(0, 7);
    S.edits[mk] = (S.edits[mk] || 0) + 1;
    const n = S.edits[mk];
    save(); closeModal(); render();
    if (n >= 2 && !S.editRemindOff) {
      if (n - 1 === 3) {
        openModal(`<h3>一句小提醒</h3>
          <p class="muted" style="font-size:13.5px">${EDIT_REMIND_TEXT}</p>
          <div class="actions">
            <button class="btn ghost" data-action="edit-remind-off">关闭此提醒</button>
            <button class="btn primary" data-action="close-modal">知道啦</button>
          </div>`);
      } else {
        toast(EDIT_REMIND_TEXT);
      }
    } else {
      toast('记录已修改');
    }
    checkCross(before, pctNow());
    return;
  }
  if (kind === 'deposit') {
    const dep = { id: uid(), label: fd.get('label').trim(), amount: Number(fd.get('amount')), date: fd.get('date') };
    S.deposits.push(dep);
    potsOnIncome(dep);
    save(); closeModal(); render(); toast('已登记到账');
    return;
  }
  if (kind === 'plan-advice') {
    pendingPlan = {
      name: fd.get('name').trim(),
      amount: Number(fd.get('amount')),
      date: fd.get('date'),
      trend: fd.get('trend') || null
    };
    render();
    $('#adviceCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (kind === 'income') {
    S.income = { salary: Number(fd.get('salary')), fixed: Number(fd.get('fixed')) };
    save(); render(); toast('收入规划已更新');
    return;
  }
});

window.addEventListener('hashchange', render);

function boot() {
  $('#brandMark').innerHTML = ICONS.piggy;
  document.querySelectorAll('[data-ico]').forEach((el) => { el.innerHTML = ICONS[el.dataset.ico] || ''; });
  const MOB_LABEL = { home: '首页', privacy: '授权', records: '记录', live: '流水', plan: '规划', pots: '分桶', reminders: '提醒', identity: '身份' };
  const MOB_ICON = { home: 'home', privacy: 'shield', records: 'receipt', live: 'pulse', plan: 'target', pots: 'pots', reminders: 'bell', identity: 'swap' };
  $('#mobileNav').innerHTML = Object.keys(ROUTES).filter((key) => key !== 'history').map((key) =>
    `<a href="#/${key}" data-route="${key}">${ICONS[MOB_ICON[key]]}<span>${MOB_LABEL[key]}</span>${key === 'reminders' ? '<span class="badge" id="remBadgeM" hidden></span>' : ''}</a>`).join('');
  if (!location.hash) location.hash = '#/home';
  AI.onChange = () => {
    if (currentRoute() === 'records') render();
  };
  render();
  AI.check();
  simBoot();
}
boot();