'use strict';
/* v2.1 资金分桶(上班族解锁):Monzo Pots / Starling Spaces 式资金物理隔离。
   到账自动分装 → 桶内消费做减法 → 分类限额关怀提醒 → 零钱归整 → 自动分类月报 + 本地问答。
   所有数字只来自用户真实记录与台账,不编造。 */

const POT_PRESETS = [
  { name: '房租桶', color: '#6366f1', ico: 'i-home', monthly: 1500, cats: [], keywords: '自如|公寓|房租|租房' },
  { name: '账单桶', color: '#2563eb', ico: 'i-coin', monthly: 300, cats: ['other'], keywords: '水电|缴费|话费|移动|联通|电信' },
  { name: '周饭钱桶', color: '#f59e0b', ico: 'i-meal', monthly: 600, cats: ['food'], keywords: '' },
  { name: '零钱罐', color: '#10b981', ico: 'i-jar', monthly: 0, cats: [], keywords: '', round: true }
];
const POT_COLORS = ['#6366f1', '#2563eb', '#f59e0b', '#10b981', '#ec4899', '#94a3b8'];
const LEDGER_LABEL = { income: '到账', alloc: '自动分装', spend: '桶内消费', mainSpend: '主余额消费', roundup: '零钱归整', manual: '手动调整' };

let reportMonth = null;
let reportDim = 'cat';
let askResult = null;
let askQuery = '';

const potsActive = () => S.identity === 'worker';
const potById = (id) => S.pots.find((p) => p.id === id);
const potBalance = (id) => S.potLedger.filter((e) => e.potId === id).reduce((s, e) => s + e.amount, 0);
const mainBalance = () => S.potLedger.filter((e) => e.potId == null).reduce((s, e) => s + e.amount, 0);
const potsTotal = () => S.pots.reduce((s, p) => s + potBalance(p.id), 0);
const roundPot = () => potById(S.potRoundPotId) || S.pots.find((p) => p.round);

function potEntry(kind, potId, amount, note, date, simId) {
  S.potLedger.push({ id: uid(), date: date || today(), kind, potId: potId || null, amount: Math.round(amount * 100) / 100, note, simId: simId || null });
}

function potsOnIncome(dep) {
  if (!potsActive()) return;
  potEntry('income', null, dep.amount, dep.label, dep.date, dep.simId);
  if (!S.potAutoAlloc || !S.pots.length) return;
  const month = dep.date.slice(0, 7);
  const done = [];
  const short = [];
  S.pots.forEach((p) => {
    if (!(p.monthly > 0)) return;
    if (S.potLedger.some((e) => e.kind === 'alloc' && e.potId === p.id && e.date.startsWith(month))) return;
    const avail = mainBalance();
    const amt = Math.min(p.monthly, Math.max(0, avail));
    if (amt > 0) {
      potEntry('alloc', null, -amt, `分装至「${p.name}」`, dep.date, dep.simId);
      potEntry('alloc', p.id, amt, '到账自动分装', dep.date, dep.simId);
      done.push(`${p.name} ${money0(amt)}`);
      if (amt < p.monthly) short.push(p.name);
    } else short.push(p.name);
  });
  if (done.length) {
    careToast(`到账已自动分装:${done.join('、')}。主余额还剩 ${money(mainBalance())},桶里的钱不会被误花。`);
  }
  if (short.length) {
    careToast(`这次到账不够分满「${short.join('、')}」,先紧着已有的装了。没关系,下次到账会自动补齐。`);
  }
}

function potsOnSpend(rec) {
  if (!potsActive() || !isClassified(rec)) return;
  const prevMain = mainBalance();
  const kwPot = S.pots.find((p) => p.keywords && new RegExp(p.keywords).test(rec.merchant));
  const catPot = S.pots.find((p) => !p.round && p.cats.includes(rec.cat));
  const pot = kwPot || catPot;
  if (pot) {
    const bal = potBalance(pot.id);
    if (bal >= rec.amount) {
      potEntry('spend', pot.id, -rec.amount, rec.merchant, rec.date, rec.simId);
      const thr = Math.max(50, (pot.monthly || 0) * 0.2);
      const left = bal - rec.amount;
      if (bal >= thr && left < thr) {
        careToast(`「${pot.name}」只剩 ${money(left)} 了,这几天留意一下就好。不够时随时可以从主余额补进去,不用紧张。`);
      }
    } else {
      potEntry('mainSpend', null, -rec.amount, `${rec.merchant}（${pot.name}不足）`, rec.date, rec.simId);
      careToast(`「${pot.name}」不够付这笔 ${money(rec.amount)},先从主余额出了。有空补一点进桶里就好。`);
    }
  } else {
    potEntry('mainSpend', null, -rec.amount, rec.merchant, rec.date, rec.simId);
  }
  if (S.potRoundUp) {
    const rp = roundPot();
    const diff = Math.ceil(rec.amount) - rec.amount;
    if (rp && diff > 0.004) {
      potEntry('roundup', null, -diff, `归整 ${rec.merchant}`, rec.date, rec.simId);
      potEntry('roundup', rp.id, diff, `归整 ${rec.merchant}`, rec.date, rec.simId);
    }
  }
  if (prevMain >= 0 && mainBalance() < 0) {
    careToast('主余额有点透支了,我们一起看看接下来的安排,没关系的。');
  }
}

function catLimitReminders() {
  if (!potsActive()) return [];
  const out = [];
  const month = today().slice(0, 7);
  CATEGORIES.forEach((c) => {
    const limit = Number(S.catLimits[c.id]);
    if (!(limit > 0)) return;
    const list = monthRecords().filter((r) => r.cat === c.id);
    const sum = list.reduce((s, r) => s + r.amount, 0);
    const pct = sum / limit * 100;
    if (pct < 80) return;
    out.push({
      id: `catlim-${c.id}-${month}`,
      date: today(),
      type: 'catlimit',
      text: pct >= 100
        ? `本月「${c.name}」已花 ${money(sum)},到了你设的 ${money0(limit)} 限额。超一点也没关系,我们一起看看接下来怎么安排,决定权在你。`
        : `本月「${c.name}」已花 ${money(sum)},接近你设的 ${money0(limit)} 限额（${Math.round(pct)}%）。接下来几天稍微留意一下就好,不用紧张。`
    });
  });
  return out;
}

/* ---------- 月报(分类 + 商户双维度) ---------- */
function reportMonths() {
  return [...new Set(S.records.map((r) => r.date.slice(0, 7)))].sort().reverse();
}
function reportData() {
  const months = reportMonths();
  const cur = today().slice(0, 7);
  if (!reportMonth || !months.includes(reportMonth)) reportMonth = months.includes(cur) ? cur : months[0];
  if (!reportMonth) return { month: cur, list: [], total: 0, prevKey: '', prevTotal: 0, cats: [], merchants: [] };
  const list = S.records.filter((r) => isClassified(r) && r.date.startsWith(reportMonth));
  const total = list.reduce((s, r) => s + r.amount, 0);
  const cm = {};
  const mm = {};
  list.forEach((r) => {
    cm[r.cat] = (cm[r.cat] || 0) + r.amount;
    const e = (mm[r.merchant] = mm[r.merchant] || { name: r.merchant, n: 0, sum: 0, cat: r.cat });
    e.n++; e.sum += r.amount;
  });
  const prevKey = (() => {
    const [y, m] = reportMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const prevTotal = S.records.filter((r) => isClassified(r) && r.date.startsWith(prevKey)).reduce((s, r) => s + r.amount, 0);
  return {
    month: reportMonth, list, total, prevKey, prevTotal,
    cats: Object.entries(cm).sort((a, b) => b[1] - a[1]),
    merchants: Object.values(mm).sort((a, b) => b.sum - a.sum)
  };
}

/* ---------- 本地智能问答(规则解析,不联网、不编造) ---------- */
const ASK_SUBJECTS = [
  [/外卖/, { re: /美团|饿了么/, label: '外卖' }],
  [/奶茶|茶饮/, { re: /蜜雪|喜茶|奈雪|茶百道|古茗|书亦|霸王茶姬/, label: '奶茶茶饮' }],
  [/咖啡/, { re: /瑞幸|星巴克|库迪|Manner/i, label: '咖啡' }],
  [/打车|网约车/, { re: /滴滴|曹操|T3|哈啰/, label: '打车' }],
  [/地铁|公交|交通/, { cat: 'transport', label: '交通' }],
  [/吃饭|餐饮|饭钱|食堂/, { cat: 'food', label: '餐饮' }],
  [/购物|淘宝|京东|拼多多/, { re: /淘宝|京东|拼多多|天猫|得物|优衣库/, label: '购物' }],
  [/娱乐|电影|游戏|音乐/, { cat: 'fun', label: '娱乐' }],
  [/学习|书|打印/, { cat: 'study', label: '学习' }],
  [/日用|超市/, { cat: 'daily', label: '日用' }],
  [/话费|水电|账单/, { re: /移动|联通|电信|水电|缴费/, label: '话费账单' }],
  [/房租/, { re: /自如|公寓|房租/, label: '房租' }]
];
function askAnswer(q) {
  const text = String(q || '').trim();
  if (!text) return null;
  const n = simNow();
  let from, to, rangeLabel;
  const dm = text.match(/近\s*(\d+)\s*天/);
  if (/上个月|上月/.test(text)) {
    const d = new Date(n.getFullYear(), n.getMonth() - 1, 1);
    from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    to = from; rangeLabel = `${from}（上个月）`;
  } else if (dm) {
    const days = Number(dm[1]);
    from = fmtDate(new Date(nowMs() - days * DAY)); to = today();
    rangeLabel = `近 ${days} 天`;
  } else if (/今年/.test(text)) {
    from = String(n.getFullYear()); to = String(n.getFullYear()); rangeLabel = `${n.getFullYear()} 年`;
  } else {
    from = today().slice(0, 7); to = from; rangeLabel = `${from}（本月）`;
  }
  const inRange = (r) => r.date.startsWith(from) || (from.length === 10 && r.date >= from && r.date <= to);
  let list = S.records.filter((r) => isClassified(r) && (to === from ? r.date.startsWith(from) : inRange(r)));
  let subjectLabel = '全部支出';
  const hit = ASK_SUBJECTS.find(([re]) => re.test(text));
  if (hit) {
    const s = hit[1];
    subjectLabel = s.label;
    list = s.cat ? list.filter((r) => r.cat === s.cat) : list.filter((r) => s.re.test(r.merchant));
  }
  const sum = list.reduce((s, r) => s + r.amount, 0);
  if (!list.length) return { answer: `${rangeLabel}还没有「${subjectLabel}」相关的已定案记录。等记录进来后,这里会如实算给你。`, items: [] };
  const mm = {};
  list.forEach((r) => { const e = (mm[r.merchant] = mm[r.merchant] || { name: r.merchant, n: 0, sum: 0 }); e.n++; e.sum += r.amount; });
  const tops = Object.values(mm).sort((a, b) => b.sum - a.sum).slice(0, 3);
  const max = list.reduce((a, b) => (b.amount > a.amount ? b : a));
  let answer;
  if (/几笔|多少次|几次/.test(text)) {
    answer = `${rangeLabel}${subjectLabel}共 ${list.length} 笔,合计 ${money(sum)}。`;
  } else if (/最多|最大|哪笔/.test(text)) {
    answer = `${rangeLabel}${subjectLabel}最大一笔是 ${max.merchant} ${money(max.amount)}（${max.date}）。`;
  } else {
    answer = `${rangeLabel}${subjectLabel}共 ${list.length} 笔,合计 ${money(sum)},单笔均 ${money(sum / list.length)}。`;
  }
  answer += ` 主要去向:${tops.map((t) => `${t.name} ${money(t.sum)}（${t.n} 笔）`).join('、')}。`;
  return { answer, items: list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8) };
}

/* ---------- 视图 ---------- */
function potCardHTML(p) {
  const bal = potBalance(p.id);
  const month = today().slice(0, 7);
  const used = S.potLedger.filter((e) => e.potId === p.id && e.kind === 'spend' && e.date.startsWith(month)).reduce((s, e) => s - e.amount, 0);
  const low = p.monthly > 0 && bal < Math.max(50, p.monthly * 0.2);
  const scope = [p.keywords ? `商户关键词:${p.keywords}` : '', p.cats.length ? `分类:${p.cats.map((c) => catOf(c).name).join('、')}` : ''].filter(Boolean).join(' · ') || '手动管理,不自动扣减';
  return `
  <div class="card pot-card" style="border-top:3px solid ${p.color}">
    <div class="spread">
      <b><svg class="pot-ico" style="color:${p.color}"><use href="#${p.ico}"/></svg> ${esc(p.name)}${p.round ? ' <span class="tag ok">归整目标</span>' : ''}</b>
      <span class="dim">${p.monthly > 0 ? `每月装 ${money0(p.monthly)}` : '只进不出'}</span>
    </div>
    <div class="pot-bal num" style="color:${bal < 0 ? 'var(--rose)' : 'var(--ink)'}">${money(bal)}</div>
    <div class="dim">本月桶内已花 ${money(used)} · ${esc(scope)}</div>
    ${low ? `<div class="pot-low">只剩 ${money(bal)} 了,留意一下就好,随时可以从主余额补。</div>` : ''}
    <div class="row mt">
      <button class="btn sm" data-action="pot-adjust" data-id="${p.id}">转入 / 转出</button>
      <button class="btn sm ghost" data-action="pot-edit" data-id="${p.id}">编辑</button>
      <button class="btn sm ghost" data-action="pot-del" data-id="${p.id}">删除</button>
    </div>
  </div>`;
}

function potsView() {
  if (!potsActive()) {
    return `
    <div class="card auth-card">
      <h3 class="auth-h">资金分桶 · 上班族解锁</h3>
      <div class="grid-2 auth-feats">
        <div class="auth-feat"><b>到账自动分装</b><span>工资一到账,按你设的每月额度自动装桶,主余额只留可自由支配的部分</span></div>
        <div class="auth-feat"><b>桶内做减法</b><span>「饭钱桶只剩 ¥200」比「本月已花 ¥1800」更有体感</span></div>
        <div class="auth-feat"><b>限额与归整</b><span>分类限额关怀提醒;每笔消费向上归整到元,零钱自动攒进零钱罐</span></div>
        <div class="auth-feat"><b>月报与问答</b><span>自动分类月报,分类 / 商户双维度;直接问「这个月外卖花了多少」</span></div>
      </div>
      <div class="mt"><a class="btn primary" href="#/identity">去切换为上班族</a></div>
    </div>
    <div class="notice">学生阶段聚焦支出规划,不提前推送资金管理营销;切换身份后这里会完整解锁,已有数据不受影响。</div>`;
  }
  const rd = reportData();
  const months = reportMonths();
  const main = mainBalance();
  const monthIn = S.potLedger.filter((e) => e.kind === 'income' && e.date.startsWith(today().slice(0, 7))).reduce((s, e) => s + e.amount, 0);
  const maxCat = rd.cats.length ? rd.cats[0][1] : 0;
  const rp = roundPot();
  const rounded = rp ? S.potLedger.filter((e) => e.kind === 'roundup' && e.potId === rp.id).reduce((s, e) => s + e.amount, 0) : 0;
  return `
  <div class="card focus">
    <div class="spread"><span class="h-label">主余额 · 可自由支配</span><a class="btn sm" href="#/records">看消费记录</a></div>
    <div class="h-big num" style="color:${main < 0 ? 'var(--rose)' : 'var(--ink)'}">${money(main)}</div>
    <div class="h-sub">
      <div><b class="num">${money(monthIn)}</b><span>本月到账</span></div>
      <div><b class="num">${money(potsTotal())}</b><span>桶内合计（不计入主余额）</span></div>
      <div><b class="num">${money(rounded)}</b><span>零钱归整累计</span></div>
    </div>
    <div class="care-line show">桶里的钱已经被「物理隔离」,日常消费只动主余额或对应的桶,不会误花房租和账单。</div>
  </div>
  <div class="toolbar">
    <button class="btn primary" data-action="pot-new">新建桶</button>
    ${POT_PRESETS.map((p, i) => `<button class="btn sm" data-action="pot-preset" data-i="${i}">+ ${p.name}</button>`).join('')}
  </div>
  ${S.pots.length ? `<div class="grid-3 pot-grid">${S.pots.map(potCardHTML).join('')}</div>`
    : '<div class="card"><div class="empty"><div class="big">还没有桶</div>点上方预设一键创建房租桶 / 账单桶 / 周饭钱桶 / 零钱罐,到账那天自动分装</div></div>'}
  <div class="grid-2">
    <div class="card">
      <h3>自动分装与零钱归整</h3>
      <p class="sub">到账那天配置一次,之后不用自律</p>
      <div class="spread"><span>到账自动分装（按各桶每月额度）</span>
        <label class="switch"><input type="checkbox" data-change="pot-auto" ${S.potAutoAlloc ? 'checked' : ''}><i></i></label></div>
      <div class="spread mt"><span>Round-ups 零钱归整（每笔消费向上取整到元）</span>
        <label class="switch"><input type="checkbox" data-change="pot-roundup" ${S.potRoundUp ? 'checked' : ''}><i></i></label></div>
      ${S.potRoundUp ? `<div class="field mt"><label>零钱存入哪个桶</label>
        <select data-change="pot-roundpot">${S.pots.map((p) => `<option value="${p.id}" ${rp && rp.id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>` : ''}
      <p class="dim mt">例:一笔 ¥18.5 的早餐,归整 ¥0.5 进零钱罐。积少成多,全程无感。</p>
    </div>
    <div class="card">
      <h3>分类限额 · 关怀提醒</h3>
      <p class="sub">给某类消费设个月度软限额,到 80% / 100% 时温和提醒,不拦截任何消费</p>
      ${CATEGORIES.map((c) => `
      <div class="spread pot-limit-row"><span><span class="dot" style="background:${c.color}"></span> ${c.name}</span>
        <span class="dim">本月 ${money(monthRecords().filter((r) => r.cat === c.id).reduce((s, r) => s + r.amount, 0))}</span>
        <input type="number" min="0" step="50" class="inline-select pot-limit-input" data-change="cat-limit" data-cat="${c.id}" value="${S.catLimits[c.id] || ''}" placeholder="不限"></div>`).join('')}
    </div>
  </div>
  <div class="card">
    <div class="spread">
      <div><h3>自动分类月报</h3><p class="sub" style="margin:0">只统计已定案记录 · 分类 / 商户双维度</p></div>
      <div class="toolbar">
        <select class="inline-select" data-change="report-month">${months.map((m) => `<option value="${m}" ${m === rd.month ? 'selected' : ''}>${m}</option>`).join('')}</select>
        <div class="seg">
          <button data-action="report-dim" data-v="cat" class="${reportDim === 'cat' ? 'on' : ''}">分类</button>
          <button data-action="report-dim" data-v="merchant" class="${reportDim === 'merchant' ? 'on' : ''}">商户</button>
        </div>
      </div>
    </div>
    <div class="stat-line mt">
      <div><b>${money(rd.total)}</b><span>本月已定案支出</span></div>
      <div><b>${rd.list.length}</b><span>笔数</span></div>
      <div><b>${rd.prevTotal ? (rd.total > rd.prevTotal ? '+' : '') + Math.round((rd.total - rd.prevTotal) / rd.prevTotal * 100) + '%' : '—'}</b><span>环比 ${rd.prevKey}</span></div>
    </div>
    ${rd.total ? (reportDim === 'cat' ? `
    <div class="report-bars mt">${rd.cats.map(([id, v]) => `
      <div class="rb-row"><span class="rb-name"><span class="dot" style="background:${catOf(id).color}"></span>${catOf(id).name}</span>
        <div class="bar rb-bar"><i style="width:${Math.round(v / maxCat * 100)}%;background:${catOf(id).color}"></i></div>
        <b class="num">${money(v)}</b><span class="dim">${Math.round(v / rd.total * 100)}%</span></div>`).join('')}</div>` : `
    <div class="list mt">${rd.merchants.slice(0, 10).map((m) => `
      <div class="list-item"><div class="grow"><div class="title">${esc(m.name)}</div><div class="meta">${m.n} 笔 · ${catOf(m.cat).name}</div></div>
        <b class="num">${money(m.sum)}</b></div>`).join('')}</div>`)
    : '<div class="empty mt">这个月还没有已定案支出</div>'}
  </div>
  <div class="card">
    <h3>问一句 · 本地智能问答</h3>
    <p class="sub">直接提问,例如「这个月外卖花了多少」「上个月咖啡几笔」· 规则解析你的真实记录,不联网、不编造</p>
    <div class="toolbar">
      <input id="askInput" style="flex:1;min-width:200px" placeholder="这个月外卖花了多少？" value="${esc(askQuery)}">
      <button class="btn primary" data-action="ask-run">问一句</button>
    </div>
    <div class="chips mt">
      ${['这个月外卖花了多少', '上个月咖啡几笔', '近 30 天交通花了多少', '本月最大一笔是什么'].map((q) => `<button class="spend-chip ask-eg" data-action="ask-eg" data-q="${q}">${q}</button>`).join('')}
    </div>
    ${askResult ? `<div class="ask-answer mt"><p>${esc(askResult.answer)}</p>
      ${askResult.items.length ? `<div class="list mt">${askResult.items.map((r) => `<div class="list-item"><div class="grow"><div class="title">${esc(r.merchant)}</div><div class="meta">${r.date} · ${catOf(r.cat).name}</div></div><span class="amount out">-${money(r.amount)}</span></div>`).join('')}</div>` : ''}</div>` : ''}
  </div>
  <div class="card">
    <h3>资金台账</h3>
    <p class="sub">每一笔分装 / 扣减 / 归整都有记录 · 最近 12 条</p>
    ${S.potLedger.length ? `<div class="list">${[...S.potLedger].reverse().slice(0, 12).map((e) => {
      const pot = e.potId ? potById(e.potId) : null;
      return `<div class="list-item"><div class="grow"><div class="title">${LEDGER_LABEL[e.kind] || e.kind} · ${esc(e.note || '')}</div>
        <div class="meta">${e.date} · ${pot ? esc(pot.name) : '主余额'}</div></div>
        <span class="amount ${e.amount >= 0 ? 'in' : 'out'}">${e.amount >= 0 ? '+' : ''}${money(e.amount)}</span></div>`;
    }).join('')}</div>` : '<div class="empty">还没有资金变动。登记一笔到账或记一笔消费后,这里会生成台账。</div>'}
  </div>
  <div class="notice">分桶是演示版资金管理:台账仅存本机浏览器;修改或删除历史记录不会回溯调整台账。桶不足时消费自动回落主余额并温和提示,绝不拦截你的任何消费。</div>`;
}

/* ---------- 弹窗 ---------- */
function potEditModal(p) {
  const isNew = !p;
  const v = p || { name: '', color: POT_COLORS[S.pots.length % POT_COLORS.length], ico: 'i-jar', monthly: 0, cats: [], keywords: '' };
  openModal(`<h3>${isNew ? '新建桶' : '编辑桶'}</h3>
    <form data-form="pot-edit">
      <input type="hidden" name="id" value="${p ? p.id : ''}">
      <div class="form-grid">
        <div class="field"><label>桶名称</label><input name="name" required maxlength="12" value="${esc(v.name)}" placeholder="如:周饭钱桶"></div>
        <div class="field"><label>每月自动装入（元,0=不自动装）</label><input name="monthly" type="number" min="0" step="50" value="${v.monthly}"></div>
      </div>
      <div class="field"><label>自动扣减的消费分类（可多选）</label>
        <div class="chips">${CATEGORIES.map((c) => `<label class="check-chip"><input type="checkbox" name="cats" value="${c.id}" ${v.cats.includes(c.id) ? 'checked' : ''}> ${c.name}</label>`).join('')}</div></div>
      <div class="field"><label>商户关键词（正则,可选,如:自如|公寓）</label><input name="keywords" maxlength="40" value="${esc(v.keywords || '')}" placeholder="命中商户名时优先从本桶扣"></div>
      <div class="field"><label>颜色</label>
        <div class="chips">${POT_COLORS.map((c) => `<label class="check-chip"><input type="radio" name="color" value="${c}" ${v.color === c ? 'checked' : ''}> <span class="dot" style="background:${c}"></span></label>`).join('')}</div></div>
      <div class="actions"><button type="button" class="btn ghost" data-action="close-modal">取消</button>
        <button type="submit" class="btn primary">保存</button></div>
    </form>`);
}
function potAdjustModal(p) {
  openModal(`<h3>转入 / 转出 · ${esc(p.name)}</h3>
    <form data-form="pot-adjust">
      <input type="hidden" name="id" value="${p.id}">
      <div class="form-grid">
        <div class="field"><label>方向</label><select name="dir"><option value="in">主余额 → 桶（转入）</option><option value="out">桶 → 主余额（转出）</option></select></div>
        <div class="field"><label>金额（元）</label><input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00"></div>
      </div>
      <p class="dim">当前桶内 ${money(potBalance(p.id))} · 主余额 ${money(mainBalance())}</p>
      <div class="actions"><button type="button" class="btn ghost" data-action="close-modal">取消</button>
        <button type="submit" class="btn primary">确认</button></div>
    </form>`);
}

/* ---------- 事件 ---------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  if (a === 'pot-preset') {
    const pre = POT_PRESETS[Number(t.dataset.i)];
    if (S.pots.some((p) => p.name === pre.name)) return toast('这个桶已经存在啦');
    S.pots.push({ id: uid(), ...pre });
    if (pre.round && !S.potRoundPotId) S.potRoundPotId = S.pots[S.pots.length - 1].id;
    save(); render(); toast(`已创建「${pre.name}」,到账时会自动分装`);
    return;
  }
  if (a === 'pot-new') { potEditModal(null); return; }
  if (a === 'pot-edit') { potEditModal(potById(t.dataset.id)); return; }
  if (a === 'pot-adjust') { potAdjustModal(potById(t.dataset.id)); return; }
  if (a === 'pot-del') {
    const p = potById(t.dataset.id);
    if (!p) return;
    const bal = potBalance(p.id);
    confirmModal(`删除「${p.name}」`, bal > 0 ? `桶里还剩 ${money(bal)},删除后会自动回流到主余额,不会丢钱。` : '删除后该桶的历史台账仍会保留。', '删除', () => {
      if (bal > 0) potEntry('manual', null, bal, `「${p.name}」删除回流`);
      S.pots = S.pots.filter((x) => x.id !== p.id);
      if (S.potRoundPotId === p.id) S.potRoundPotId = null;
      save(); render(); toast('桶已删除');
    }, true);
    return;
  }
  if (a === 'report-dim') { reportDim = t.dataset.v; render(); return; }
  if (a === 'ask-run' || a === 'ask-eg') {
    const inp = document.getElementById('askInput');
    const q = a === 'ask-eg' ? t.dataset.q : (inp ? inp.value : '');
    askQuery = q;
    askResult = askAnswer(q);
    if (!askResult) return toast('先输入想问的问题');
    render();
    return;
  }
});

document.addEventListener('change', (e) => {
  const t = e.target.closest('[data-change]');
  if (!t) return;
  const a = t.dataset.change;
  if (a === 'pot-auto') { S.potAutoAlloc = t.checked; save(); render(); toast(t.checked ? '已开启到账自动分装' : '已关闭自动分装,可手动转入'); return; }
  if (a === 'pot-roundup') {
    S.potRoundUp = t.checked;
    if (t.checked && !roundPot()) {
      const pre = POT_PRESETS[3];
      const p = { id: uid(), ...pre };
      S.pots.push(p);
      S.potRoundPotId = p.id;
      toast('已为你创建「零钱罐」作为归整目标');
    }
    save(); render();
    if (t.checked) toast('零钱归整已开启:每笔消费向上取整到元,差额自动攒起来');
    return;
  }
  if (a === 'pot-roundpot') { S.potRoundPotId = t.value; save(); render(); return; }
  if (a === 'cat-limit') {
    const v = Number(t.value);
    if (v > 0) S.catLimits[t.dataset.cat] = v; else delete S.catLimits[t.dataset.cat];
    save(); render();
    toast(v > 0 ? `已设「${catOf(t.dataset.cat).name}」月限额 ${money0(v)},到 80% 会温和提醒` : '已取消该类限额');
    return;
  }
  if (a === 'report-month') { reportMonth = t.value; render(); return; }
});

document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  const kind = f.dataset.form;
  if (kind === 'pot-edit') {
    e.preventDefault();
    const fd = new FormData(f);
    const id = fd.get('id');
    const data = {
      name: fd.get('name').trim(),
      monthly: Number(fd.get('monthly')) || 0,
      cats: fd.getAll('cats'),
      keywords: fd.get('keywords').trim(),
      color: fd.get('color') || POT_COLORS[0],
      ico: 'i-jar'
    };
    if (data.keywords) { try { new RegExp(data.keywords); } catch (err) { return toast('商户关键词不是合法正则'); } }
    if (id) {
      const p = potById(id);
      Object.assign(p, data, { ico: p.ico });
    } else {
      S.pots.push({ id: uid(), round: false, ...data });
    }
    save(); closeModal(); render(); toast('桶已保存');
    return;
  }
  if (kind === 'pot-adjust') {
    e.preventDefault();
    const fd = new FormData(f);
    const p = potById(fd.get('id'));
    const amt = Number(fd.get('amount'));
    if (!p || !(amt > 0)) return toast('请填写有效金额');
    if (fd.get('dir') === 'in') {
      potEntry('manual', null, -amt, `手动转入「${p.name}」`);
      potEntry('manual', p.id, amt, '手动转入');
    } else {
      if (potBalance(p.id) < amt) return toast('桶内余额不足');
      potEntry('manual', p.id, -amt, '手动转出');
      potEntry('manual', null, amt, `「${p.name}」转出`);
    }
    save(); closeModal(); render(); toast('已调整');
    return;
  }
});