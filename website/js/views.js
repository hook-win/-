'use strict';

const QUESTIONS = [
  { q: 'id', title: '你现在是？', opts: [['fresh', '大一'], ['soph', '大二 / 大三'], ['senior', '大四'], ['grad', '研究生']] },
  { q: 'life', title: '每月生活费大概多少？', opts: [['1200', '1000–1500'], ['1800', '1500–2000'], ['2400', '2000–3000'], ['3000', '3000 以上'], ['uncertain', '说不准']] },
  { q: 'rhythm', title: '生活费怎么到账？', opts: [['month', '家里按月给'], ['term', '家里按学期给'], ['part', '兼职收入'], ['aid', '奖助贷']] },
  { q: 'goal', title: '这学期最想搞定的一件事？', opts: [['big', '攒钱买一件大东西'], ['takeout', '控制外卖和奶茶'], ['noloan', '月底不借钱'], ['clear', '搞清楚钱花在哪']] },
  { q: 'unit', title: '平时一笔小额消费，大概多少？', opts: [['10', '¥10 以下'], ['12.5', '¥10–15'], ['17.5', '¥15–20'], ['22', '¥20 以上']] },
  { q: 'remind', title: '希望什么时候提醒你？', opts: [['now', '当场提醒'], ['evening', '晚上汇总'], ['self', '主动看时'], ['none', '不用提醒']] },
  { q: 'budgetMode', title: '预算上限怎么定？', opts: [['suggest', '用你建议的数'], ['self', '我自己填'], ['later', '先不设']] },
  { q: 'invest', title: '理财相关的内容，你希望？', opts: [['yes', '愿意看看'], ['ask', '只在我问时'], ['no', '不需要']] }
];

function setupRowHTML() {
  return `<div class="setup-row">
    <input name="merchant" maxlength="30" placeholder="商户 / 用途">
    <input name="amount" type="number" min="0.01" step="0.01" placeholder="金额">
    <input name="date" type="date" value="${today()}">
    <input name="time" type="time" title="可选：用于时间带判断">
    <select name="cat"><option value="auto" selected>自动判断</option>${catOptions(null)}</select>
    <button type="button" class="btn ghost sm" data-action="del-setup-row" title="删除该行">删除</button>
  </div>`;
}

function surveyView() {
  const a = SV.a;
  const answered = Object.values(a).some((v) => v != null && v !== '');
  const blocks = QUESTIONS.map((Q, i) => `
    <div class="q-block ${i === SV.step ? 'active' : ''}" data-q="${Q.q}">
      <div class="q-title"><i>${i + 1}</i>${Q.title}</div>
      <div class="q-opts">${Q.opts.map(([v, l]) =>
        `<button type="button" class="q-opt ${a[Q.q] === v ? 'on' : ''}" data-action="sv-opt" data-q="${Q.q}" data-v="${v}">${l}</button>`).join('')}
      </div>
    </div>`).join('');
  return `
  <div class="card">
    <div class="spread" style="margin-bottom:14px">
      <div><h3>前期问卷 · 生成你的专属基准</h3>
      <p class="sub" style="margin:0">八题、约三分钟、可跳过。答案只存本机，用于个性化预算、提醒与目标建议。</p></div>
      <span class="tag info">首页总览 · 冷启动</span>
    </div>
    <div class="sv-grid">
      <div>
        <div class="q-progress">${QUESTIONS.map((_, k) => `<i class="${k < SV.step ? 'done' : k === SV.step ? 'cur' : ''}"></i>`).join('')}</div>
        ${blocks}
        <div class="q-nav">
          <button type="button" class="base-link" data-action="sv-prev" ${SV.step === 0 ? 'disabled' : ''}>上一题</button>
          <span class="q-count">${SV.step + 1} / ${QUESTIONS.length}</span>
          <button type="button" class="base-link next" id="svNext" data-action="sv-next" ${a[QUESTIONS[SV.step].q] == null ? 'disabled' : ''}>${SV.step === QUESTIONS.length - 1 ? '生成我的基准' : '下一题'}</button>
        </div>
        <div class="base-actions">
          <button type="button" class="base-link" data-action="sv-skip">先跳过，自己填写数据</button>
          ${answered ? '<button type="button" class="base-link" data-action="sv-reset">清空重来</button>' : ''}
        </div>
      </div>
      <div class="bp-phone" id="svPreview">${svPreviewHTML()}</div>
    </div>
  </div>
  <div class="notice">问卷产出基准卡（预算 / 日均 / 提醒线 / 目标 / 单价 / 提醒时机 / 理财意愿），进入首页后全部按它渲染；所有统计仍只基于你填写的真实数据，不会编造任何数字。</div>`;
}

function setupView() {
  return `
  <div class="card">
    <div class="spread"><h3>填写你的生活费与支出数据</h3>
      <button class="btn sm" data-action="retake-survey">回到问卷</button></div>
    <p class="sub">${S.survey && S.survey.skipped ? '已跳过问卷 · ' : ''}所有统计只基于你填写的数据：我们不会编造任何数字，也不会私自调取银行流水。</p>
    <form data-form="setup">
      <div class="field" style="max-width:280px"><label>月生活费（元）</label>
        <input name="budget" type="number" min="1" step="1" required placeholder="如 1500"></div>
      <label class="dim">已有支出记录（可选；填写后立即生成统计，之后也可在「消费记录」中补充）</label>
      <div id="setupRows">${setupRowHTML()}</div>
      <div class="mt"><button type="button" class="btn sm" data-action="add-setup-row">添加一条支出</button></div>
      <p class="dim mt">分类默认自动判断：高置信直接归类；美团/淘宝等聚合收单按金额带+时间带猜测、攒起来批量确认；异常/乱码/陌生商户进未分类池（仅汇总、不参与建议）。也可在每行显式指定分类。</p>
      <div class="actions" style="display:flex;justify-content:flex-end;margin-top:18px">
        <button type="submit" class="btn primary">保存并开始统计</button>
      </div>
    </form>
  </div>
  <div class="notice">采集方式可选：到「授权与隐私」授权后打开导入窗口，导入银行导出的历史流水文件；或从零开始积累。无论哪种，数据都由你提供。</div>`;
}

function homeView() {
  const mr = monthRecords();
  const spent = mr.reduce((s, r) => s + r.amount, 0);
  const left = S.budget - spent;
  const pctRaw = (spent / S.budget) * 100;
  const pct = Math.min(100, Math.round(pctRaw));
  const st = stateOf(pctRaw);
  const care = careText(pctRaw, mr.length);
  const entries = catSum(mr);
  const rems = visibleReminders().slice(0, 2);
  const goal = goalInfo();
  const small = smallRecords();
  const smallTotal = small.reduce((s, r) => s + r.amount, 0);
  const unit = unitPrice();
  const sv = S.survey || {};
  const grade = GRADE_LABEL[sv.id];
  const greet = S.identity === 'worker' ? '你好，上班族' : `你好，${grade || '同学'}`;

  const incomeCard = S.identity === 'worker' ? (S.income ? `
    <div class="card">
      <div class="spread"><h3>收入规划</h3><a href="#/identity" class="dim">调整</a></div>
      <p class="sub">上班族身份解锁的能力</p>
      <div class="stat-line">
        <div><b>${money0(S.income.salary)}</b><span>月薪</span></div>
        <div><b>${money0(S.income.fixed)}</b><span>固定支出</span></div>
        <div><b style="color:var(--green)">${money0(S.income.salary - S.income.fixed)}</b><span>可储蓄 / 可支配</span></div>
      </div>
      <p class="dim mt">主余额 <b class="num">${money(mainBalance())}</b> · 桶内 <b class="num">${money(potsTotal())}</b> · <a href="#/pots">去资金分桶</a></p>
      <p class="dim">理财推荐已强化，但仍仅在你主动订阅后推送。</p>
    </div>` : `
    <div class="card"><div class="spread"><h3>收入规划</h3><a class="btn primary sm" href="#/identity">去填写</a></div>
    <p class="sub" style="margin:0">上班族身份已解锁收入规划，填写月薪与固定支出后在此展示。</p></div>`) : '';

  return `
  <div class="hero-band">
    <div class="aurora"><i></i><i></i><i></i></div>
    <div class="inner">
      <span class="eyebrow"><span class="dot"></span>月尺银行 · 生活费管家</span>
      <h2>${greet}，这个月按你的节奏来</h2>
      <div class="chips">
        ${grade ? `<span>${grade}</span>` : ''}
        ${sv.goal ? `<span>目标 · ${GOAL_LABEL[sv.goal]}</span>` : ''}
        ${sv.rhythm ? `<span>${RHYTHM_LABEL[sv.rhythm]}</span>` : ''}
        <span>数据仅存本机</span>
      </div>
    </div>
  </div>
  <div class="home-grid">
    <div class="card focus" style="position:relative">
      <div class="m-pulse" id="homePulse"></div>
      <div class="spread"><span class="h-label">本月还剩</span><span class="state-chip ${st}">${CHIP_TEXT[st]}</span></div>
      <div class="h-big num"><span id="homeBig">${money0(left)}</span><small> / 预算 ${money0(S.budget)}</small></div>
      <div class="bar" style="margin-top:10px"><i id="homeBar" class="${st === 'ok' ? '' : st}" style="width:${pct}%"></i></div>
      <div class="h-sub">
        <div><b class="num">${money(spent)}</b><span>本月已花</span></div>
        <div><b class="num">${money(todaySum())}</b><span>今日支出</span></div>
        <div><b class="num">${money0(dailyLeft())}</b><span>日均可用</span></div>
      </div>
      <div class="care-line" id="homeCare">${care}</div>
      ${goal ? `<div class="goal-line"><b>目标 · ${goal.label}</b>　${goal.progress}　${goal.tip}</div>` : ''}
      <div class="row mt">
        <button class="btn primary sm" data-action="add-record">记一笔支出</button>
        <button class="btn sm" data-action="edit-budget">调整月生活费</button>
        <a class="btn sm" href="#/history">浏览历史记录</a>
      </div>
    </div>
    <div class="card">
      <div class="spread"><h3>我的基准</h3><button class="btn sm" data-action="retake-survey">调整问卷</button></div>
      <p class="sub">${sv.done ? '来自前期问卷 · 个性化已生效' : '问卷已跳过 · 默认基准'}</p>
      <div class="bp-row"><span>月预算</span><b class="num">${money0(S.budget)}${sv.done && sv.budgetMode === 'suggest' ? ' · 问卷建议' : ' · 自己填写'}</b></div>
      <div class="bp-row"><span>提醒线（80%）</span><b class="num">${money0(S.budget * 0.8)}</b></div>
      <div class="bp-row"><span>日均可用</span><b class="num">${money0(dailyLeft())}</b></div>
      <div class="bp-row"><span>小额单价锚点</span><b>${unit ? money(unit) + ' / 笔' : '记录后自动识别'}</b></div>
      <div class="bp-row"><span>提醒时机</span><b>${REMIND_LABEL[S.thresholdMode]}</b></div>
      <div class="bp-row"><span>理财意愿</span><b>${sv.invest ? INVEST_LABEL[sv.invest] : '默认不推送'}</b></div>
      ${sv.rhythm ? `<p class="dim mt">${RHYTHM_NOTE[sv.rhythm]}</p>` : ''}
    </div>
  </div>
  <div class="home-grid">
    <div class="card">
      <h3>小额累计罐</h3>
      <p class="sub">近 30 天单笔 ≤ ¥50 的已定案支出 · 单笔「不贵」，累计「不少」</p>
      ${small.length ? `
      <div class="acc-jar">
        <span class="lab">小额累计</span>
        <div class="acc-total num">${money(smallTotal)}<small> / 生活费 ${money0(S.budget)}</small></div>
        <div class="acc-eq">占生活费 <b>${(smallTotal / S.budget * 100).toFixed(1)}%</b>${unit ? ` · 相当于 <b>${Math.round(smallTotal / unit)}</b> 笔小额消费` : ''}</div>
        <div class="bar"><i class="warn" style="width:${Math.min(100, smallTotal / S.budget * 100)}%"></i></div>
      </div>
      <div class="chips mt">${small.slice(0, 12).map((r) => `<span class="spend-chip">${esc(r.merchant)}<b class="num">${money(r.amount)}</b></span>`).join('')}${small.length > 12 ? `<span class="spend-chip">+${small.length - 12} 笔</span>` : ''}</div>`
      : '<div class="empty"><div class="big">还没有小额支出记录</div>记一笔后，这里会把隐形的小口子聚合成大数字</div>'}
    </div>
    <div class="card">
      <h3>支出结构</h3>
      <p class="sub">按你填写的分类统计，可在消费记录中手动修正</p>
      ${entries.length ? `<div class="donut-wrap">${donutSVG(entries, spent)}
        <div class="legend">${entries.slice(0, 5).map(([id, val]) => `
          <div class="row"><span class="name"><span class="dot" style="background:${catOf(id).color}"></span>${catOf(id).name}</span>
          <span class="muted">${money(val)} · ${Math.round(val / spent * 100)}%</span></div>`).join('')}
        </div></div>` : '<div class="empty"><div class="big">本月还没有支出数据</div>点击「记一笔支出」开始填写</div>'}
    </div>
  </div>
  ${(() => {
    const pm = pendingMid(), pl = poolLow();
    if (!pm.length && !pl.length) return '';
    const plSum = pl.reduce((s, r) => s + r.amount, 0);
    return `<div class="notice">${pm.length ? `有 <strong>${pm.length} 笔</strong>聚合收单消费待批量确认（猜分类已攒好，一次点完）。` : ''}${pl.length ? ` 未分类池 <strong>${pl.length} 笔 / ${money(plSum)}</strong>，仅汇总展示、不参与统计与建议。` : ''}
      <div class="mt"><a class="btn primary sm" href="#/records">去处理</a></div></div>`;
  })()}
  ${incomeCard}
  <div class="grid-2">
    <div class="card">
      <div class="spread"><h3>最近提醒</h3><a href="#/reminders" class="dim">全部提醒</a></div>
      <p class="sub">自动总结小额消费规律，按消费类型给出关怀式建议</p>
      ${rems.length ? `<div class="list">${rems.map((m) => `
        <div class="list-item"><div class="grow">
          <div class="meta">${m.date} · ${m.type === 'wealth' ? '订阅内容' : m.type === 'threshold' ? '阈值提醒' : m.type === 'pattern' ? '小额规律' : m.type === 'catlimit' ? '分类限额' : '累计提醒'}</div>
          <div class="muted" style="font-size:13px">${esc(m.text).slice(0, 46)}…</div>
        </div>${m.read ? '' : '<span class="unread-dot"></span>'}</div>`).join('')}</div>`
      : '<div class="empty">填写支出后，这里会按周生成累计提醒</div>'}
    </div>
    <div class="card">
      <div class="spread"><h3>大额消费计划</h3><a href="#/plan" class="dim">去规划</a></div>
      <p class="sub">建议仅基于已定案记录（高置信+已确认），仅供参考</p>
      ${S.plans.length ? `<div class="list">${S.plans.slice(0, 3).map((p) => {
        const ad = computeAdvice(p);
        const [cls, label] = LEVEL_TAG[ad.level];
        return `<div class="list-item"><div class="grow"><div class="title">${esc(p.name)}</div>
          <div class="meta">${money(p.amount)} · 计划 ${p.date}</div></div>
          <span class="tag ${cls}">${label}</span></div>`;
      }).join('')}</div>` : '<div class="empty"><div class="big">还没有大额计划</div>登记一个计划，获取基于你数据的建议与具象锚点</div>'}
    </div>
  </div>`;
}

function viewHome() {
  if (!S.survey) { if (!SV) svInit(null); return surveyView(); }
  if (!S.scheme) return authOnboardView();
  if (!S.budget) return setupView();
  return homeView();
}

function flowSteps(cur) {
  const labels = ['问卷基准', '授权决定', '导入流水', '归类确认'];
  return `<div class="flow-steps">${labels.map((l, i) =>
    `<div class="fs ${i < cur ? 'done' : i === cur ? 'cur' : ''}"><i>${i < cur ? '✓' : i + 1}</i><span>${l}</span></div>`).join('')}</div>`;
}

function consentBlockHTML(mode) {
  const modal = mode === 'modal';
  return `
  <div data-consent-scope>
    <div class="consent-box">
      <label class="consent-line"><input type="checkbox" data-change="auth-consent">
        <span>我同意提供过去约一年的消费记录，用于消费归类与规划建议。是否分享完全由我决定。</span></label>
      <div class="auth-disclosure" hidden>
        <div><b>上传范围</b>：过去约一年的消费流水（交易时间、金额、对方户名、摘要、交易渠道），由你通过银行导出的文件或粘贴内容提供。</div>
        <div><b>用途</b>：仅用于消费归类与规划建议；不做后台推断，不用于授信。</div>
        <div><b>存储与脱敏</b>：本地版未接入银行后台，数据仅保存在本机浏览器，不上传任何服务器，不向第三方回传可识别信息。</div>
        <div><b>留存</b>：授权有效期内保留，可在「授权与隐私」随时撤回；撤回时可一键删除已导入的历史流水。</div>
      </div>
    </div>
    <div class="row mt">
      <button class="btn primary auth-agree" data-action="${modal ? 'do-auth' : 'onboard-agree'}" disabled>同意并导入历史消费</button>
      <button class="btn" data-action="${modal ? 'close-modal' : 'onboard-decline'}">${modal ? '再想想' : '暂不上传'}</button>
    </div>
    <p class="dim mt">本功能不承诺任何收益；不分享数据也可以使用基础服务，我们不会反复提示。</p>
  </div>`;
}

function authOnboardView() {
  return `
  <div class="card auth-card">
    ${flowSteps(1)}
    <h3 class="auth-h">先看看能为你做什么，<br>再决定是否分享数据</h3>
    <p class="sub">问卷基准已生成。接下来由你决定：授权后打开导入窗口，导入银行历史消费快速完成归类；或者不分享，从今天开始记录。</p>
    <div class="grid-2 auth-feats">
      <div class="auth-feat"><b>自动归类</b><span>品牌商户、校园场景、固定订阅、公交地铁直接命中归类，不打扰你</span></div>
      <div class="auth-feat"><b>批量确认</b><span>美团 / 淘宝等聚合收单按金额带 + 时间带猜测，攒成一组一次点完，不逐笔弹窗</span></div>
      <div class="auth-feat"><b>未分类池</b><span>金额异常、乱码或陌生商户只做汇总展示，不参与统计与建议，避免算错</span></div>
      <div class="auth-feat"><b>数据只在本机</b><span>导入的流水仅存本机浏览器；系统不会编造任何数据，授权本身不产生任何记录</span></div>
    </div>
    ${consentBlockHTML('onboard')}
  </div>
  <div class="notice">银行流水可见：交易时间、金额、对方户名、摘要、交易渠道；不可见：具体商品、微信 / 支付宝内部订单、多店合并支付明细。第三方支付在银行侧显示为聚合主体（如财付通、支付宝-XX 商户），因此部分消费只能先猜测、再请你批量确认。</div>`;
}

function viewPrivacy() {
  const schemeName = S.scheme === 'A' ? '方案 A · 授权导入历史数据' : S.scheme === 'B' ? '方案 B · 从零开始积累' : '未选择';
  const imported = S.records.filter((r) => r.src === 'import').length;
  return `
  <div class="card">
    <div class="spread">
      <div><h3>当前采集状态</h3><p class="sub" style="margin:0">${schemeName}</p></div>
      <span class="tag ${S.authorized ? 'ok' : 'mute'}">${S.authorized ? '已授权' : '未授权'}</span>
    </div>
    <p class="dim mt">数据范围：${S.scheme === 'A' && S.authorized ? '过往一年消费记录（由你导入，只用于分类与提醒）' : '仅本服务内你填写的记录'}。授权随时可撤回。</p>
    ${S.authorized ? '<div class="mt"><button class="btn danger sm" data-action="revoke-auth">撤回授权</button></div>' : ''}
  </div>

  <div class="card">
    <div class="spread">
      <div><h3>历史消费导入窗口</h3>
      <p class="sub" style="margin:0">支持银行导出的 CSV / TXT 文件或直接粘贴流水文本 · 自动识别交易时间、金额、对方户名、摘要、渠道等列</p></div>
      ${S.authorized
        ? '<button class="btn primary" data-action="open-import">打开导入窗口</button>'
        : '<button class="btn" data-action="choose-scheme" data-scheme="A">先完成授权</button>'}
    </div>
    ${S.lastImport
      ? `<p class="dim mt">最近导入：${S.lastImport.ts} · ${esc(S.lastImport.file)} · ${S.lastImport.total} 笔（直接归类 ${S.lastImport.high} / 待确认 ${S.lastImport.mid} / 未分类 ${S.lastImport.low}${S.lastImport.skipped ? ` / 跳过 ${S.lastImport.skipped}` : ''}）· 当前已导入 ${imported} 笔</p>`
      : '<p class="dim mt">尚未导入历史流水。授权后打开窗口选择文件或粘贴内容，所有数据都来自你提供的文件，系统不会编造。</p>'}
  </div>

  <div class="grid-2">
    <div class="scheme ${S.scheme === 'A' ? 'on' : ''}">
      <h4>方案 A · 授权导入历史数据 ${S.scheme === 'A' ? '<span class="tag info">使用中</span>' : ''}</h4>
      <ol>
        <li>勾选同意，查看上传范围 / 用途 / 存储 / 留存</li>
        <li>打开导入窗口，提供银行导出的流水文件或文本</li>
        <li>系统按三档置信度自动生成归类结果</li>
        <li>中置信批量确认、未分类池手动修正</li>
      </ol>
      <div class="feat">快速完成初始消费画像，降低后续交互成本</div>
      <button class="btn ${S.scheme === 'A' ? '' : 'primary'}" data-action="choose-scheme" data-scheme="A">${S.scheme === 'A' ? '重新查看授权' : '选择此方案'}</button>
    </div>
    <div class="scheme ${S.scheme === 'B' ? 'on' : ''}">
      <h4>方案 B · 从零开始积累 ${S.scheme === 'B' ? '<span class="tag info">使用中</span>' : ''}</h4>
      <ol>
        <li>选择不调取历史数据</li>
        <li>从首次使用起逐步记录消费行为</li>
        <li>系统逐步学习适应消费习惯</li>
      </ol>
      <div class="feat">完全尊重用户隐私，无历史数据泄露风险</div>
      <button class="btn ${S.scheme === 'B' ? '' : 'primary'}" data-action="choose-scheme" data-scheme="B">${S.scheme === 'B' ? '当前方案' : '选择此方案'}</button>
    </div>
  </div>

  <div class="card">
    <h3>授权披露</h3>
    <p class="sub">与授权勾选处展示的内容一致</p>
    <div class="auth-disclosure static">
      <div><b>上传范围</b>：过去约一年的消费流水（交易时间、金额、对方户名、摘要、交易渠道），由你通过银行导出的文件或粘贴内容提供。</div>
      <div><b>用途</b>：仅用于消费归类与规划建议；不做后台推断，不用于授信。</div>
      <div><b>存储与脱敏</b>：本地版未接入银行后台，数据仅保存在本机浏览器，不上传任何服务器，不向第三方回传可识别信息。</div>
      <div><b>留存</b>：授权有效期内保留，可随时撤回；撤回时可一键删除已导入的历史流水，手动填写的记录始终保留。</div>
    </div>
  </div>

  <div class="notice">本地版未接入银行后台：无论选择哪种方案，历史与新增消费都由你导入或自行录入；分类修正（校准）在消费记录中点击分类标签完成。前期问卷答案同样仅存本机。系统不会编造任何数据。</div>

  <div class="notice mt">
    <strong>隐私保护原则</strong>
    <ul style="margin:6px 0 0;padding-left:18px">
      <li>所有历史消费数据调取操作必须提前告知用户</li>
      <li>完全由用户自主选择是否授权</li>
      <li>禁止私自通过银行后台流水分析用户行为</li>
    </ul>
  </div>
  <div class="spread mt"><span class="dim">填写数据仅保存在本机浏览器</span><button class="btn ghost sm" data-action="reset-demo">清空全部数据</button></div>`;
}

function heatCard() {
  const hd = heatData();
  if (!hd.total) {
    return `<div class="card"><h3>本月消费热力</h3><p class="sub">日历二维阵列 · 整月模式一眼显形</p>
      <div class="empty"><div class="big">本月还没有已定案支出</div>记一笔后，消费节奏与高峰会在日历上自己浮现</div></div>`;
  }
  const first = new Date(hd.year, hd.month, 1);
  const lead = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="heat-cell empty"></div>');
  for (let d = 1; d <= hd.days; d++) {
    const date = `${hd.year}-${String(hd.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const v = hd.map[date] ? hd.map[date].sum : 0;
    cells.push(`<div class="heat-cell" data-date="${date}" style="background:${heatColor(v, hd.max)}"></div>`);
  }
  while (cells.length % 7) cells.push('<div class="heat-cell empty"></div>');
  const ins = [];
  if (hd.weekend.n && hd.weekday.n) {
    const ratio = (hd.weekend.sum / hd.weekend.n) / (hd.weekday.sum / hd.weekday.n);
    ins.push(`<div class="ins rose">周末日均 <b>${money(hd.weekend.sum / hd.weekend.n)}</b>，是工作日的 <b>${ratio.toFixed(1)} 倍</b>——高峰在日历右两列一眼可见。</div>`);
  }
  ins.push(`<div class="ins green">本月 <b>${hd.zero} 个零消费日</b>，浅色块同样是有价值的正向反馈。</div>`);
  ins.push(`<div class="ins">本月已定案合计 <b>${money(hd.total)}</b>，与小额累计罐互为印证。</div>`);
  return `
  <div class="card">
    <h3>本月消费热力</h3>
    <p class="sub">每日已定案支出映射为色块深浅 · 悬停查看当日明细</p>
    <div class="heat-wrap">
      <div style="position:relative" id="heatHost">
        <div class="heat-grid" id="heatGrid">
          ${['一', '二', '三', '四', '五', '六', '日'].map((w) => `<div class="wd">${w}</div>`).join('')}
          ${cells.join('')}
        </div>
        <div class="heat-tip" id="heatTip"></div>
      </div>
      <div class="heat-side">
        <span style="font-size:12px;font-weight:700;color:var(--ink-2)">当日消费强度</span>
        <div class="legend-scale"><i style="background:#e6eef9"></i><i style="background:#c3d9f3"></i><i style="background:#8fb6e8"></i><i style="background:#4a89e0"></i><i style="background:#dc2626"></i></div>
        <div class="legend-lab"><span>¥0</span><span>${money0(hd.max / 2)}</span><span>${money0(hd.max)}+</span></div>
        <div class="heat-insight">${ins.join('')}</div>
      </div>
    </div>
  </div>`;
}

function viewRecords() {
  let list = S.records.filter(isClassified).sort((a, b) => b.date.localeCompare(a.date));
  if (recordFilter.range < 9000) list = list.filter((r) => daysAgo(r.date) < recordFilter.range);
  if (recordFilter.cat !== 'all') list = list.filter((r) => r.cat === recordFilter.cat);
  if (recordFilter.q) list = list.filter((r) => r.merchant.includes(recordFilter.q));
  const sum = list.reduce((s, r) => s + r.amount, 0);
  const days = recordFilter.range < 9000 ? recordFilter.range : 30;
  const pm = pendingMid(), pl = poolLow();
  const pmSum = pm.reduce((s, r) => s + r.amount, 0);
  const plSum = pl.reduce((s, r) => s + r.amount, 0);
  const groups = midGroups();

  return `
  <div class="card">
    <div class="toolbar">
      <input type="search" placeholder="搜索商户…" value="${esc(recordFilter.q)}" data-change="search" style="flex:1;min-width:140px">
      <div class="filters">
        ${[[7, '近 7 天'], [30, '近 30 天'], [9999, '全部']].map(([v, label]) =>
          `<button data-action="filter-range" data-range="${v}" class="${recordFilter.range === v ? 'on' : ''}">${label}</button>`).join('')}
      </div>
      <div class="seg">
        <button data-action="record-view" data-v="list" class="${recordView === 'list' ? 'on' : ''}">列表</button>
        <button data-action="record-view" data-v="heat" class="${recordView === 'heat' ? 'on' : ''}">热力</button>
      </div>
      <button class="btn primary" data-action="add-record">记一笔</button>
      <button class="btn" data-action="open-import">导入历史流水</button>
      <a class="btn" href="#/history">历史消费记录</a>
    </div>
    <div class="filters mt">
      <button data-action="filter-cat" data-cat="all" class="${recordFilter.cat === 'all' ? 'on' : ''}">全部分类</button>
      ${CATEGORIES.map((c) => `<button data-action="filter-cat" data-cat="${c.id}" class="${recordFilter.cat === c.id ? 'on' : ''}">${c.name}</button>`).join('')}
    </div>
    <div class="stat-line mt">
      <div><b>${list.length}</b><span>已定案笔数</span></div>
      <div><b>${money(sum)}</b><span>累计支出</span></div>
      <div><b>${money(sum / days)}</b><span>日均</span></div>
    </div>
    <p class="dim">另有待确认 ${pm.length} 笔 / ${money(pmSum)}，未分类 ${pl.length} 笔 / ${money(plSum)}：均不计入以上统计与任何建议。</p>
  </div>

  ${groups.length ? `
  <div class="card">
    <h3>批量确认（中置信猜测）</h3>
    <p class="sub">聚合收单主体按金额带+时间带猜分类；攒成一组一次点完，不逐笔弹窗</p>
    <div class="list">${groups.map((g) => `
      <div class="list-item">
        <div class="grow">
          <div class="title">这 ${g.items.length} 笔我猜是${esc(g.label)}（${catOf(g.guess).name}），对吗？</div>
          <div class="meta">${g.items.slice(0, 4).map((r) => `${esc(r.merchant)} ${money(r.amount)}`).join('；')}${g.items.length > 4 ? '…' : ''} · 合计 ${money(g.items.reduce((s, r) => s + r.amount, 0))}</div>
        </div>
        <select class="inline-select" data-change="regroup" data-key="${g.key}" title="整组改判">${catOptions(g.guess)}</select>
        <button class="btn green sm" data-action="confirm-group" data-key="${g.key}">对，一次归类</button>
      </div>`).join('')}</div>
  </div>` : ''}

  ${pl.length ? `
  <div class="card">
    <div class="spread">
      <h3>未分类池（低置信）</h3>
      <button class="btn sm" data-action="ai-classify-pool" ${AI.healthInfo() && AI.healthInfo().ok ? '' : 'disabled title="需要本地 AI 代理：node simulator/server.js"'}>AI 猜分类</button>
    </div>
    <p class="sub">共 ${pl.length} 笔 / ${money(plSum)} · 仅汇总展示，不参与任何建议；手动指定或采纳 AI 建议后才计入统计</p>
    <div class="list">${pl.map((r) => {
      const s = AI.sugg(r.id);
      return `
      <div class="list-item">
        <div class="grow">
          <div class="title">${esc(r.merchant)}</div>
          <div class="meta">${r.user ? esc(r.user) + ' · ' : ''}${r.date} · ${money(r.amount)} · ${esc(r.reason)}</div>
          ${s ? `<div class="ai-sugg"><span class="tag info">AI 猜 ${esc(catOf(s.cat).name)} · ${esc(s.label)} · ${Math.round(s.confidence * 100)}%</span><span class="dim">${esc(s.reason)}</span></div>` : ''}
        </div>
        ${s ? `<button class="btn green sm" data-action="ai-adopt" data-id="${r.id}">采纳</button>` : ''}
        <select class="inline-select" data-change="pool-cat" data-id="${r.id}"><option value="">保持未分类</option>${catOptions(null)}</select>
        <button class="btn ghost sm" data-action="edit-record" data-id="${r.id}">修改</button>
      </div>`;
    }).join('')}</div>
  </div>` : ''}

  ${recordView === 'heat' ? heatCard() : `
  <div class="card">
    <h3>已定案明细</h3>
    <p class="sub">高置信自动归类 + 批量/手动确认后的记录；点击分类标签可修正</p>
    ${list.length ? `<div class="list">${list.map((r) => `
      <div class="list-item">
        <div class="grow"><div class="title">${esc(r.merchant)}</div><div class="meta">${r.user ? esc(r.user) + ' · ' : ''}${r.date}${r.time ? ' ' + r.time : ''} · ${esc(r.reason || '手动填写')}</div></div>
        ${catChip(r, true)}
        <span class="amount out">-${money(r.amount)}</span>
        <button class="btn ghost sm" data-action="edit-record" data-id="${r.id}">修改</button>
      </div>`).join('')}</div>`
    : `<div class="empty"><div class="big">还没有已定案的支出</div>
       记一笔后高置信会直接归类，其余进入上方批量确认或未分类池
       <div class="mt"><button class="btn primary sm" data-action="add-record">记一笔</button></div></div>`}
  </div>`}

  <div class="card">
    <h3>三档分类规则</h3>
    <p class="sub">让填写更省力的自动分档</p>
    <ul class="muted" style="margin:0;padding-left:18px;font-size:13px;display:flex;flex-direction:column;gap:6px">
      <li><strong>高置信</strong>：品牌商户命中、校园地理围栏、固定金额固定日期订阅、公交地铁通道 —— 直接归类，不打扰</li>
      <li><strong>中置信</strong>：美团/饿了么/淘宝/京东等聚合收单 —— 按金额带+时间带给猜测，攒起来批量确认</li>
      <li><strong>低置信</strong>：金额异常、商户名乱码、一次性陌生商户 —— 进未分类池，只汇总、不参与建议</li>
    </ul>
  </div>`;
}

let historyMonth = null;

function viewHistory() {
  const months = [...new Set(S.records.map((r) => r.date.slice(0, 7)))].sort().reverse();
  if (!months.length) {
    return `<div class="card"><div class="empty"><div class="big">还没有任何消费记录</div>
      先在首页填写或记一笔；也可以在授权后导入银行历史流水，之后这里可以按月浏览
      <div class="mt"><a class="btn primary sm" href="#/home">回首页填写</a>
      <button class="btn sm" data-action="open-import">导入历史流水</button></div></div></div>`;
  }
  const cur = today().slice(0, 7);
  if (!historyMonth || !months.includes(historyMonth)) historyMonth = months.includes(cur) && months.length > 1 ? months[1] : months[0];
  const list = S.records.filter((r) => r.date.startsWith(historyMonth)).sort((a, b) => b.date.localeCompare(a.date));
  const done = list.filter(isClassified);
  const pm = list.filter((r) => r.tier === 'mid' && !r.confirmed);
  const pl = list.filter((r) => r.tier === 'low' && !r.confirmed);
  const sum = done.reduce((s, r) => s + r.amount, 0);
  const entries = catSum(done);
  return `
  <div class="card">
    <div class="spread">
      <div><h3>按月浏览</h3><p class="sub" style="margin:0">历史消费记录只读浏览；修改请回到「消费记录」</p></div>
      <select class="inline-select" data-change="history-month">
        ${months.map((m) => `<option value="${m}" ${m === historyMonth ? 'selected' : ''}>${m}${m === cur ? '（本月）' : ''}</option>`).join('')}
      </select>
    </div>
    <div class="stat-line mt">
      <div><b>${done.length}</b><span>已定案笔数</span></div>
      <div><b>${money(sum)}</b><span>已定案累计</span></div>
      <div><b>${list.length}</b><span>全部笔数</span></div>
    </div>
    <p class="dim">待确认 ${pm.length} 笔 / ${money(pm.reduce((s, r) => s + r.amount, 0))} · 未分类 ${pl.length} 笔 / ${money(pl.reduce((s, r) => s + r.amount, 0))}（不参与统计与建议）</p>
    ${entries.length ? `<div class="donut-wrap mt">${donutSVG(entries, sum)}
      <div class="legend">${entries.slice(0, 5).map(([id, val]) => `
        <div class="row"><span class="name"><span class="dot" style="background:${catOf(id).color}"></span>${catOf(id).name}</span>
        <span class="muted">${money(val)} · ${Math.round(val / sum * 100)}%</span></div>`).join('')}</div></div>` : ''}
  </div>
  <div class="card">
    <h3>${historyMonth} 明细</h3>
    <p class="sub">含各档状态：已定案 / 待批量确认 / 未分类</p>
    <div class="list">${list.map((r) => `
      <div class="list-item">
        <div class="grow"><div class="title">${esc(r.merchant)}</div><div class="meta">${r.user ? esc(r.user) + ' · ' : ''}${r.date}${r.time ? ' ' + r.time : ''} · ${esc(r.reason || '手动填写')}</div></div>
        ${isClassified(r) ? catChip(r, false) : r.tier === 'mid' ? `<span class="tag warn">猜 ${esc(r.guessLabel)} · 待确认</span>` : `<span class="tag mute">未分类 · ${esc(r.reason)}</span>`}
        <span class="amount out">-${money(r.amount)}</span>
      </div>`).join('')}</div>
    <div class="mt"><a class="btn sm" href="#/records">去消费记录修改 / 确认</a></div>
  </div>`;
}

function anchorCard() {
  const opts = anchorOptions();
  return `
  <div class="card">
    <h3>具象锚点换算</h3>
    <p class="sub">把抽象金额翻译成你的身体经验 · 锚点来自你的高频小额记录或问卷单价</p>
    ${opts.length ? `
    <div class="anchor-ctrl">
      <div class="field" style="margin:0"><label>计划消费金额（¥）</label>
        <input type="number" id="anchorAmt" min="1" max="20000" step="1" value="${pendingPlan ? pendingPlan.amount : ''}" placeholder="如 899" style="width:130px"></div>
      <div class="field" style="margin:0"><label>换算锚点</label>
        <select id="anchorUnit" data-change="anchor-unit" style="width:auto">
          ${opts.map((o, i) => `<option value="${o.value}" data-ico="${o.ico}" data-name="${esc(o.name)}" ${String(o.value) === String(anchorUnit) || (anchorUnit == null && i === 0) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
        </select></div>
    </div>
    <p class="anchor-result" id="anchorResult"></p>
    <div class="picto" id="picto"></div>
    <p class="anchor-note">象形阵列最多展示 96 个单元，超出折叠为计数。不说「别买」，只说「它相当于多少」——判断权在你。</p>`
    : '<div class="empty"><div class="big">还没有可用锚点</div>填写问卷的小额单价，或记几笔高频小额消费后，这里会自动生成换算</div>'}
  </div>`;
}

function viewPlan() {
  const ad = pendingPlan ? computeAdvice(pendingPlan) : null;
  const [cls, label] = ad ? LEVEL_TAG[ad.level] : [];
  const defaultDate = fmtDate(new Date(nowMs() + 14 * DAY));
  const dl = daysLeft();
  const pacing = ad && S.budget && ad.left > 0
    ? (pendingPlan.amount <= ad.left
      ? `购买后日均可用将从 ${money0(ad.left / dl)} 降到 ${money0(Math.max(0, ad.left - pendingPlan.amount) / dl)}（剩余 ${dl} 天）。`
      : `计划金额超出本月余量，购买后日均将归零并透支 ${money0(pendingPlan.amount - ad.left)}。`)
    : '';
  return `
  <div class="grid-2">
    <div class="card">
      <h3>登记大额消费计划</h3>
      <p class="sub">主动登记后，系统结合你已定案的近期支出与预算余量给出参考建议</p>
      <form data-form="plan-advice">
        <div class="field"><label>商品 / 用途</label><input name="name" required maxlength="30" placeholder="如：降噪耳机"></div>
        <div class="form-grid">
          <div class="field"><label>预计金额（元）</label><input name="amount" type="number" min="1" step="0.01" required placeholder="0.00"></div>
          <div class="field"><label>计划购买日期</label><input name="date" type="date" value="${defaultDate}" required></div>
        </div>
        <div class="field"><label>你观察到的近期价格趋势（可选）</label>
          <select name="trend">
            <option value="">未观察</option>
            <option value="down">下行</option>
            <option value="flat">平稳</option>
            <option value="up">上行</option>
          </select>
        </div>
        <button type="submit" class="btn primary">获取购买建议</button>
      </form>
    </div>
    <div class="card">
      <h3>建议如何生成</h3>
      <p class="sub">只使用你填写的数据，不编造外部信息</p>
      <ul class="muted" style="margin:0;padding-left:18px;font-size:13px;display:flex;flex-direction:column;gap:6px">
        <li>近 30 天支出累计占月生活费超过 60% 时，收紧大额建议</li>
        <li>计划金额超出本月余量时，建议暂缓或调整预算</li>
        <li>价格趋势仅采用你自己填写的观察（可选）</li>
        <li>「剩余框架」：用购买后日均变化引导，而非简单说「不建议买」</li>
        <li>仅提供引导性参考，不强制控制任何消费</li>
      </ul>
    </div>
  </div>
  ${ad ? `
  <div class="advice" id="adviceCard">
    <div class="head">
      <h3>${esc(pendingPlan.name)} · ${money(pendingPlan.amount)}</h3>
      <span class="tag ${cls}">${label}</span>
    </div>
    <div class="grid-2">
      <div>
        <div class="dim mb">近 30 天支出累计 ${money(ad.cum)}${S.budget ? ` · 占月生活费 ${Math.round(ad.ratio * 100)}%` : ''}</div>
        <div class="bar"><i class="${ad.ratio > 0.6 ? 'stop' : ad.ratio > 0.4 ? 'warn' : ''}" style="width:${Math.min(100, Math.round(ad.ratio * 100))}%"></i></div>
      </div>
      <div>
        <div class="dim mb">本月余量 ${money(ad.left)}</div>
        <div class="dim">${pendingPlan.trend ? `你观察的价格趋势：${TREND_LABEL[pendingPlan.trend]}` : '未填写价格观察'}</div>
      </div>
    </div>
    <p class="txt">${ad.text}</p>
    ${pacing ? `<p class="txt" style="color:var(--violet)">${pacing}</p>` : ''}
    <p class="dim">以上为引导性参考，是否购买完全由你决定。</p>
    <div class="actions" style="display:flex;gap:10px;margin-top:12px">
      <button class="btn primary" data-action="register-plan">仍要登记计划</button>
      <button class="btn ghost" data-action="drop-plan">放弃</button>
    </div>
  </div>` : ''}
  ${anchorCard()}
  <div class="card">
    <h3>已登记的计划</h3>
    <p class="sub">建议随你填写的数据动态更新</p>
    ${S.plans.length ? `<div class="list">${S.plans.map((p) => {
      const a = computeAdvice(p);
      const [c2, l2] = LEVEL_TAG[a.level];
      return `<div class="list-item">
        <div class="grow"><div class="title">${esc(p.name)}</div><div class="meta">${money(p.amount)} · 计划 ${p.date} · 登记于 ${p.createdAt}</div></div>
        <span class="tag ${c2}">${l2}</span>
        <button class="btn ghost sm" data-action="delete-plan" data-id="${p.id}">删除</button>
      </div>`;
    }).join('')}</div>` : '<div class="empty"><div class="big">还没有登记计划</div>在左侧登记一个大额消费计划试试</div>'}
  </div>`;
}

function viewReminders() {
  const rems = visibleReminders();
  const unread = rems.filter((m) => !m.read).length;
  const sv = S.survey || {};
  return `
  <div class="grid-2">
    <div class="card">
      <h3>提醒设置</h3>
      <p class="sub">小额消费不做实时干预：先自动总结消费规律，再按类型给出关怀式建议，都只基于你的真实记录</p>
      <div class="field"><label>提醒频率</label>
        <select data-change="freq">
          <option value="weekly" ${S.reminderFreq === 'weekly' ? 'selected' : ''}>每周一次</option>
          <option value="biweekly" ${S.reminderFreq === 'biweekly' ? 'selected' : ''}>每两周一次</option>
        </select>
      </div>
      <div class="field"><label>预算阈值（80% / 100%）提醒时机${sv.remind ? ' · 来自问卷' : ''}</label>
        <select data-change="threshold-mode">
          <option value="now" ${S.thresholdMode === 'now' ? 'selected' : ''}>当场提醒（柔和脉冲+滑入，不弹窗）</option>
          <option value="evening" ${S.thresholdMode === 'evening' ? 'selected' : ''}>晚上汇总（只进提醒列表）</option>
          <option value="self" ${S.thresholdMode === 'self' ? 'selected' : ''}>主动看时（只进首页与列表）</option>
          <option value="none" ${S.thresholdMode === 'none' ? 'selected' : ''}>不用提醒（只换颜色）</option>
        </select>
      </div>
      <p class="dim">提醒语气为人文关怀式，不是管控；也不会在购物或支付环节弹出打断你。</p>
      <p class="dim mt">修改提醒：${S.editRemindOff ? '已关闭。' : '开启中（本月第 1 次修改不提醒，第 2 次起每次温和提醒，第 3 次提醒时可选择关闭）。'}</p>
      ${S.editRemindOff ? '<div class="mt"><button class="btn sm" data-action="edit-remind-on">重新开启修改提醒</button></div>' : ''}
    </div>
    <div class="card">
      <div class="spread"><h3>理财建议订阅</h3>
        <label class="switch"><input type="checkbox" data-change="wealth" ${S.wealthOptIn ? 'checked' : ''}><i></i></label>
      </div>
      <p class="sub">默认关闭 · 弱营销处理${sv.invest ? ` · 问卷意愿：${INVEST_LABEL[sv.invest]}` : ''}</p>
      <p class="muted" style="font-size:13px">学生阶段理财需求较弱，我们默认不推送任何理财内容。仅在你主动开启后，才会在你登记大额到账时展示一条稳健型建议。</p>
      ${S.wealthOptIn ? `<div class="mt"><button class="btn sm" data-action="add-deposit">登记一笔大额到账</button></div>` : ''}
      <p class="dim mt">${S.wealthOptIn ? '已订阅：登记的大额到账会在下方生成理财建议。' : '未订阅：下方不会展示任何理财内容，营销位保持一行灰字。'}</p>
    </div>
  </div>
  ${sv.done ? `
  <div class="card">
    <div class="spread"><h3>问卷基准</h3><button class="btn sm" data-action="retake-survey">调整问卷</button></div>
    <p class="sub">个性化来源 · 仅存本机</p>
    <div class="bp-row"><span>年级</span><b>${GRADE_LABEL[sv.id] || '—'}</b></div>
    <div class="bp-row"><span>目标</span><b>${GOAL_LABEL[sv.goal] || '—'}</b></div>
    <div class="bp-row"><span>到账节奏</span><b>${RHYTHM_LABEL[sv.rhythm] || '—'}</b></div>
    <div class="bp-row"><span>小额单价</span><b>${sv.unit ? '¥' + sv.unit : '—'}</b></div>
  </div>` : ''}
  <div class="card">
    <div class="spread"><h3>提醒列表</h3>${unread ? '<button class="btn sm" data-action="read-all">全部已读</button>' : ''}</div>
    <p class="sub">${unread ? unread + ' 条未读' : '没有未读提醒'} · 规律提醒按月自动总结小额消费，累计提醒按周计算，都只基于你的真实记录</p>
    ${rems.length ? `<div style="display:flex;flex-direction:column;gap:10px">${rems.map((m) => `
      <div class="rem ${m.type === 'wealth' ? 'wealth' : m.type === 'threshold' ? 'threshold' : m.type === 'pattern' ? 'pattern' : m.type === 'catlimit' ? 'catlimit' : ''} ${m.read ? 'read' : ''}">
        <div class="meta">${m.date} · ${m.type === 'wealth' ? '订阅内容 · 理财建议' : m.type === 'threshold' ? '预算阈值提醒' : m.type === 'pattern' ? '小额消费规律 · 个性化建议' : m.type === 'catlimit' ? '分类限额 · 关怀提醒' : '阶段性累计提醒'} ${m.read ? '' : '<span class="unread-dot"></span>'}</div>
        <p>${esc(m.text)}</p>
        ${m.read ? '' : `<div class="mt"><button class="btn sm ghost" data-action="read-reminder" data-id="${m.id}">标记已读</button></div>`}
      </div>`).join('')}</div>`
    : '<div class="empty"><div class="big">暂无提醒</div>填写支出记录后，这里会按周生成累计提醒</div>'}
  </div>`;
}

function viewIdentity() {
  const worker = S.identity === 'worker';
  const stages = [
    ['初始推广', ['依托开学季学生办卡场景', '银行 APP 内展示服务入口', '精准触达有需求的学生'], 'done'],
    ['学生专属', ['核心聚焦支出规划', '弱化理财营销内容', '主动授权后才推理财提醒'], worker ? 'done' : 'now'],
    ['身份切换', ['步入职场自动升级能力', '新增收入规划功能', '强化理财推荐服务'], worker ? 'now' : 'todo']
  ];
  return `
  <div class="card">
    <div class="spread">
      <div><h3>当前身份：${worker ? '上班族' : '学生'}</h3>
      <p class="sub" style="margin:0">${worker ? '已解锁收入规划，理财推荐强化（仍受订阅开关约束）' : '聚焦支出规划，理财内容弱化处理'}</p></div>
      ${worker
        ? '<button class="btn" data-action="switch-back">切回学生身份</button>'
        : '<button class="btn primary" data-action="switch-identity">切换为上班族</button>'}
    </div>
    <p class="dim mt">切换不影响已有填写数据与授权状态；产品分阶段适配不同身份的需求，避免过早推送不匹配的营销内容。</p>
  </div>
  <div class="card">
    <h3>测试工具</h3>
    <p class="sub">方便反复演示与测试的清空选项</p>
    <div class="row">
      <button class="btn danger sm" data-action="reset-month">清空本月数据</button>
      <button class="btn danger sm" data-action="reset-demo">清空全部数据</button>
      <button class="btn sm" data-action="retake-survey">重新填写问卷</button>
    </div>
    <p class="dim mt">清空本月：仅移除本月消费记录、到账登记与修改计数；清空全部：回到空白首页（含问卷）。</p>
  </div>
  <div class="card">
    <h3>产品分阶段迭代路径</h3>
    <p class="sub">你当前所处的阶段已高亮</p>
    <div class="roadmap">${stages.map(([name, items, st], i) => `
      <div class="stage ${st === 'now' ? 'now' : ''}">
        <div class="no">${i + 1}</div>
        <h4>${name} ${st === 'now' ? '<span class="tag ok">当前</span>' : st === 'done' ? '<span class="tag mute">已经历</span>' : ''}</h4>
        <ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>
      </div>`).join('')}
    </div>
  </div>
  ${worker ? `
  <div class="card">
    <h3>收入规划</h3>
    <p class="sub">上班族身份新增能力 · 由你填写</p>
    <form data-form="income">
      <div class="form-grid">
        <div class="field"><label>月薪（元）</label><input name="salary" type="number" min="0" step="100" value="${S.income ? S.income.salary : ''}" required placeholder="如 6500"></div>
        <div class="field"><label>每月固定支出（元）</label><input name="fixed" type="number" min="0" step="100" value="${S.income ? S.income.fixed : ''}" required placeholder="如 2600"></div>
      </div>
      <button type="submit" class="btn primary">保存收入规划</button>
    </form>
    ${S.income ? `<p class="dim mt">可储蓄 / 可支配：${money0(S.income.salary - S.income.fixed)}。理财推荐已强化，但是否接收仍由「提醒中心」的订阅开关决定。</p>` : ''}
  </div>` : `
  <div class="card">
    <h3>切换后将解锁</h3>
    <p class="sub">等你步入职场，产品会自动升级这些能力</p>
    <ul class="muted" style="margin:0;padding-left:18px;font-size:13px;display:flex;flex-direction:column;gap:6px">
      <li>收入规划：月薪、固定支出与可储蓄概览</li>
      <li>强化理财推荐服务（仍仅在你主动订阅后推送）</li>
      <li>从支出规划扩展到收支一体的规划能力</li>
    </ul>
  </div>`}`;
}