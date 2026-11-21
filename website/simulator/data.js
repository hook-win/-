'use strict';
/* 确定性模拟流水生成:2021-09 入学 ~ 2026-06 工作首年,共 251 笔。
   字段严格限于银行流水可见范围,固定随机种子保证每次启动完全一致。 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20210901);
const ri = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const rf = (min, max, step) => Math.round((min + rnd() * (max - min)) / step) * step;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const pad2 = (n) => String(n).padStart(2, '0');

function monthsBetween(y1, m1, y2, m2) {
  const out = [];
  let y = y1, m = m1;
  while (y < y2 || (y === y2 && m <= m2)) {
    out.push({ y, m });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

const STUDENT_MONTHS = monthsBetween(2021, 9, 2025, 6);
const WORK_MONTHS = monthsBetween(2025, 7, 2026, 6);
const ALL_MONTHS = [...STUDENT_MONTHS, ...WORK_MONTHS];

function phaseOf(y, m) {
  const t = y * 12 + m;
  if (t < 2022 * 12 + 7) return 'fresh';
  if (t < 2023 * 12 + 7) return 'soph';
  if (t < 2024 * 12 + 7) return 'junior';
  if (t < 2025 * 12 + 7) return 'senior';
  return 'work';
}
const PHASE_LABEL = { fresh: '大一', soph: '大二', junior: '大三', senior: '大四实习', work: '工作首年' };

/* 商户模板:counterparty 为银行侧可见户名;第三方按聚合主体显示 */
const CAMPUS = [
  { cp: '苏州大学本部食堂', summary: '校园卡消费', channel: 'POS', min: 8, max: 25, hours: [[7, 9], [11, 13], [17, 19]], loc: '苏州大学本部', locV: true },
  { cp: '校内教育超市', summary: '校园卡消费', channel: 'POS', min: 10, max: 60, hours: [[10, 21]], loc: '苏州大学本部', locV: true },
  { cp: '图书馆打印中心', summary: '校园卡消费', channel: 'POS', min: 3, max: 15, hours: [[9, 20]], loc: '苏州大学图书馆', locV: true },
  { cp: '校园浴室', summary: '校园卡消费', channel: 'POS', min: 3, max: 8, hours: [[16, 22]], loc: '苏州大学本部', locV: true }
];
const CITY = [
  { cp: '苏州地铁', summary: '乘车码扣款', channel: '线上快捷支付', min: 2, max: 6, hours: [[7, 9], [17, 20]], loc: '江苏省苏州市', locV: true },
  { cp: '瑞幸咖啡', summary: 'POS 消费', channel: 'POS', min: 9, max: 20, hours: [[8, 10], [13, 16]], loc: '江苏省苏州市', locV: true },
  { cp: '蜜雪冰城', summary: 'POS 消费', channel: 'POS', min: 4, max: 10, hours: [[12, 21]], loc: '江苏省苏州市', locV: true },
  { cp: '麦当劳', summary: 'POS 消费', channel: 'POS', min: 20, max: 42, hours: [[11, 13], [17, 20]], loc: '江苏省苏州市', locV: true },
  { cp: '名创优品', summary: 'POS 消费', channel: 'POS', min: 20, max: 80, hours: [[13, 21]], loc: '江苏省苏州市', locV: true },
  { cp: '万达影城', summary: 'POS 消费', channel: 'POS', min: 35, max: 60, hours: [[18, 22]], loc: '江苏省苏州市', locV: true }
];
const AGG = [
  { cp: '财付通-美团外卖', summary: '快捷支付', channel: '线上快捷支付', min: 15, max: 45, hours: [[11, 13], [17, 19], [21, 23]], locV: false },
  { cp: '财付通-滴滴出行', summary: '快捷支付', channel: '线上快捷支付', min: 10, max: 30, hours: [[8, 9], [17, 22]], locV: false },
  { cp: '支付宝-淘宝', summary: '快捷支付', channel: '线上快捷支付', min: 25, max: 180, hours: [[12, 23]], locV: false },
  { cp: '财付通-拼多多', summary: '快捷支付', channel: '线上快捷支付', min: 9, max: 50, hours: [[12, 23]], locV: false }
];
const WORK_EXTRA = [
  { cp: '财付通-美团外卖', summary: '快捷支付', channel: '线上快捷支付', min: 20, max: 55, hours: [[11, 13], [18, 20]], locV: false },
  { cp: '支付宝-盒马鲜生', summary: '快捷支付', channel: '线上快捷支付', min: 60, max: 200, hours: [[17, 21]], locV: false },
  { cp: '苏州地铁', summary: '乘车码扣款', channel: '线上快捷支付', min: 2, max: 5, hours: [[7, 9], [18, 20]], loc: '江苏省苏州市', locV: true },
  { cp: '瑞幸咖啡', summary: 'POS 消费', channel: 'POS', min: 9, max: 18, hours: [[8, 10]], loc: '江苏省苏州市', locV: true }
];

function makeExpense(tpl, y, m, day) {
  const [h1, h2] = pick(tpl.hours);
  const hour = ri(h1, h2);
  const amount = -rf(tpl.min, tpl.max, 0.5);
  return {
    time: `${y}-${pad2(m)}-${pad2(day)} ${pad2(hour)}:${pad2(ri(0, 59))}`,
    amount: Math.round(amount * 100) / 100,
    direction: 'out',
    counterparty: tpl.cp,
    summary: tpl.summary,
    channel: tpl.channel,
    location: tpl.locV ? tpl.loc : null,
    locationVisible: !!tpl.locV
  };
}

const transactions = [];

/* 每月一笔入账:学生生活费 / 大四实习补贴 / 工作工资 */
ALL_MONTHS.forEach(({ y, m }) => {
  const phase = phaseOf(y, m);
  let income;
  if (phase === 'work') {
    income = { cp: '苏州云杉科技有限公司', summary: '工资', amount: 6500, day: 10 };
  } else if (phase === 'senior' && (y === 2025 && m >= 2)) {
    income = { cp: '苏州纳米科技有限公司', summary: '实习补贴', amount: 2500, day: 8 };
  } else {
    const life = { fresh: 1500, soph: 1800, junior: 1800, senior: 2000 }[phase];
    income = { cp: '王建国', summary: '生活费', amount: life, day: ri(1, 3) };
  }
  transactions.push({
    time: `${y}-${pad2(m)}-${pad2(income.day)} 09:${pad2(ri(0, 59))}`,
    amount: income.amount,
    direction: 'in',
    counterparty: income.cp,
    summary: income.summary,
    channel: '线上快捷支付',
    location: null,
    locationVisible: false,
    phase
  });
});

/* 支出:58 笔入账 + 4 笔展示样本 + 23 笔隔月话费之外,普通支出共 166 笔
   = 每月 2 笔 + 50 个月各加 1 笔 → 总计 251 */
const extraMonths = new Set();
while (extraMonths.size < 50) extraMonths.add(ri(0, ALL_MONTHS.length - 1));

ALL_MONTHS.forEach(({ y, m }, idx) => {
  const phase = phaseOf(y, m);
  const daysInMonth = new Date(y, m, 0).getDate();
  const usedDays = new Set([1, 2, 3, 8, 10]);
  const n = 2 + (extraMonths.has(idx) ? 1 : 0);
  const pool = phase === 'work'
    ? [...WORK_EXTRA, ...AGG.slice(0, 3), CAMPUS[0]]
    : [...CAMPUS, ...CITY, ...AGG];
  for (let k = 0; k < n; k++) {
    let day = ri(2, daysInMonth);
    let guard = 0;
    while (usedDays.has(day) && guard++ < 40) day = ri(2, daysInMonth);
    usedDays.add(day);
    const tpl = pick(pool);
    const tx = makeExpense(tpl, y, m, day);
    tx.phase = phase;
    transactions.push(tx);
  }
  /* 话费:每月 10 日固定 39 元,演示「固定金额固定日期订阅」规则 */
  if (phase !== 'work' && m % 2 === 1) {
    transactions.push({
      time: `${y}-${pad2(m)}-10 08:30`, amount: -39, direction: 'out',
      counterparty: '中国移动', summary: '话费充值', channel: '线上快捷支付',
      location: null, locationVisible: false, phase
    });
  }
});

/* 展示低置信边界的固定样本(替换掉多余支出,保持总数 251) */
const showcases = [
  { time: '2022-11-18 22:41', amount: -45, direction: 'out', counterparty: '特约商户▓▓结算', summary: 'POS 消费', channel: 'POS', location: null, locationVisible: false, phase: 'soph' },
  { time: '2024-03-15 20:12', amount: -1299, direction: 'out', counterparty: '支付宝-京东商城', summary: '快捷支付', channel: '线上快捷支付', location: null, locationVisible: false, phase: 'junior' },
  { time: '2025-08-05 10:00', amount: -1500, direction: 'out', counterparty: '支付宝-青客公寓', summary: '房租', channel: '线上快捷支付', location: null, locationVisible: false, phase: 'work' },
  { time: '2023-05-06 19:22', amount: -45, direction: 'out', counterparty: '姑苏区小巷餐饮店', summary: 'POS 消费', channel: 'POS', location: '江苏省苏州市', locationVisible: true, phase: 'junior' }
];
/* 话费已额外计入,先按时间排序再裁剪/补齐到 251 */
transactions.sort((a, b) => a.time.localeCompare(b.time));
showcases.forEach((s) => transactions.push(s));
transactions.sort((a, b) => a.time.localeCompare(b.time));
while (transactions.length > 251) {
  /* 从支出最多的月份里删一笔普通聚合消费,保留入账与展示样本 */
  const idx = transactions.findIndex((t, i) => t.direction === 'out' && t.amount > -100 && !showcases.includes(t) && i > 20);
  transactions.splice(idx, 1);
}
while (transactions.length < 251) {
  const { y, m } = pick(ALL_MONTHS);
  const tx = makeExpense(pick(AGG), y, m, ri(2, 28));
  tx.phase = phaseOf(y, m);
  transactions.push(tx);
  transactions.sort((a, b) => a.time.localeCompare(b.time));
}
transactions.forEach((t, i) => { t.id = 'tx-' + String(i + 1).padStart(3, '0'); });

module.exports = { transactions, PHASE_LABEL };