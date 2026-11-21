'use strict';

const CATEGORIES = [
  { id: 'food', name: '餐饮', color: '#f59e0b', ico: 'i-meal' },
  { id: 'transport', name: '交通', color: '#2563eb', ico: 'i-bus' },
  { id: 'study', name: '学习', color: '#6366f1', ico: 'i-book' },
  { id: 'daily', name: '日用', color: '#10b981', ico: 'i-cart' },
  { id: 'fun', name: '娱乐', color: '#ec4899', ico: 'i-ticket' },
  { id: 'other', name: '其他', color: '#94a3b8', ico: 'i-coin' }
];

const DAY = 86400000;
/* 演示时钟:接入模拟流水后由流水时间驱动,未接入时使用真实时间 */
let SIM_TIME = null;
const nowMs = () => (SIM_TIME != null ? SIM_TIME : Date.now());
const simNow = () => new Date(nowMs());
const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dstr = (offset) => fmtDate(new Date(nowMs() - offset * DAY));

function emptyState() {
  return {
    scheme: null,
    authorized: false,
    identity: 'student',
    budget: null,
    records: [],
    plans: [],
    deposits: [],
    readRem: {},
    wealthOptIn: false,
    reminderFreq: 'weekly',
    income: null,
    edits: {},
    editRemindOff: false,
    survey: null,
    thresholdMode: 'self',
    lastImport: null,
    simTime: null,
    simWorkerHinted: false,
    simDisconnected: false,
    aiConsent: { advice: false, classify: false },
    pots: [],
    potLedger: [],
    potAutoAlloc: true,
    potRoundUp: false,
    potRoundPotId: null,
    catLimits: {},
    workerSince: null
  };
}

const BRAND_RULES = [
  [/瑞幸|星巴克|蜜雪冰城|喜茶|奈雪|麦当劳|肯德基|汉堡王|德克士|华莱士/, 'food'],
  [/晨光|得力|书店|当当|文轩/, 'study'],
  [/万达影城|猫眼|淘票票|哔哩哔哩|网易云|QQ音乐|Steam|影院/, 'fun'],
  [/屈臣氏|名创优品|沃尔玛|家乐福|永辉/, 'daily'],
  [/滴滴|曹操出行|T3出行|哈啰/, 'transport'],
  [/中国移动|中国联通|中国电信/, 'other']
];
const CAMPUS_RULES = [
  [/食堂|饭堂|餐厅/, 'food'],
  [/超市|小卖部/, 'daily'],
  [/打印|复印|文具/, 'study'],
  [/洗衣|浴室|水房/, 'daily'],
  [/校车/, 'transport'],
  [/图书馆/, 'study']
];
const AGG_FOOD = /美团|饿了么/;
const AGG_SHOP = /淘宝|京东|拼多多|天猫/;

const isClassified = (r) => !!r.confirmed && !!r.cat;

function garbled(name) {
  if (name.includes(String.fromCharCode(0xFFFD))) return true;
  const bad = [...name].filter((ch) => !/[一-鿿a-zA-Z0-9·・\-\s（）()]/.test(ch)).length;
  return name.length > 0 && bad / name.length > 0.3;
}

function classify(merchant, amount, time, prior) {
  const m = merchant.trim();
  const H = (cat, reason) => ({ tier: 'high', cat, guess: cat, guessLabel: reason, confirmed: true, reason });
  const M = (guess, guessLabel, reason) => ({ tier: 'mid', cat: null, guess, guessLabel, confirmed: false, reason });
  const L = (reason) => ({ tier: 'low', cat: null, guess: null, guessLabel: null, confirmed: false, reason });
  const hour = time ? Number(time.slice(0, 2)) : null;

  if (/地铁|公交|轨道交通|巴士|乘车码/.test(m)) return H('transport', '公交地铁通道');
  if (/校园|校内|学校|大学|学院|宿舍|食堂|饭堂|图书馆|教学楼/.test(m)) {
    const hit = CAMPUS_RULES.find(([re]) => re.test(m));
    return H(hit ? hit[1] : 'other', '校园地理围栏');
  }
  const brand = BRAND_RULES.find(([re]) => re.test(m));
  if (brand) return H(brand[1], '品牌商户命中');
  const same = prior.filter((r) => r.merchant === m && r.amount === amount);
  if (same.length) {
    const day = simNow().getDate();
    const monthly = same.some((r) => Number(r.date.slice(8, 10)) === day && daysAgo(r.date) >= 25 && daysAgo(r.date) <= 35);
    const weekly = same.some((r) => daysAgo(r.date) >= 6 && daysAgo(r.date) <= 8);
    if (monthly || weekly) {
      const cat = /会员|视频|音乐|爱奇艺|优酷|腾讯|b站/i.test(m) ? 'fun' : /话费|流量/.test(m) ? 'other' : /单车|月卡/.test(m) ? 'transport' : 'other';
      return H(cat, monthly ? '固定金额固定日期订阅' : '固定周期订阅');
    }
  }
  if (AGG_FOOD.test(m)) {
    if (hour !== null && hour >= 14 && hour <= 17 && amount <= 25) return M('food', '奶茶', '聚合收单·金额带+时间带');
    if (hour !== null && ((hour >= 6 && hour <= 9) || (hour >= 11 && hour <= 13) || (hour >= 17 && hour <= 19)) && amount <= 60) return M('food', '正餐', '聚合收单·金额带+时间带');
    if (hour !== null && hour >= 21 && amount <= 40) return M('food', '夜宵', '聚合收单·金额带+时间带');
    if (amount <= 80) return M('daily', '买菜/闪购', '聚合收单·金额带');
    return M('daily', '闪购杂货', '聚合收单·金额带');
  }
  if (AGG_SHOP.test(m)) {
    if (amount <= 50) return M('daily', '日用小件', '聚合收单·金额带');
    if (amount <= 200) return M('fun', '文娱购物', '聚合收单·金额带');
    return M('other', '大件购物', '聚合收单·金额带');
  }
  if (amount > 1000) return L('金额异常');
  if (garbled(m)) return L('商户名乱码');
  if (prior.some((r) => r.merchant === m)) {
    return amount <= 50 ? M('daily', '常客消费', '重复陌生商户·金额带') : M('other', '常客消费', '重复陌生商户·金额带');
  }
  return L('一次性陌生商户');
}