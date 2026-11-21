'use strict';
/* AI 前端适配层。
   浏览器只调用本地代理 /api/ai/*，API Key 不进入前端代码或 localStorage。
   这里只管两件事：探测服务、请求猜分类。 */
const AI = (() => {
  const BASE = '/api/ai';

  const state = {
    health: null,      // null=检测中 / {ok:true,...} / {ok:false,error}
    pending: null,
    notified: false,
    busy: false
  };

  const sugg = new Map(); // record.id -> { cat, label, confidence, reason }

  function timeoutFetch(url, opts, ms) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms || 60000);
    return fetch(url, Object.assign({}, opts, { signal: ctl.signal })).finally(() => clearTimeout(timer));
  }

  function check(force) {
    if (!force && state.health) return Promise.resolve(state.health);
    if (state.pending) return state.pending;
    state.pending = (async () => {
      let h;
      try {
        const r = await timeoutFetch(`${BASE}/health`, {}, 5000);
        const j = await r.json().catch(() => ({}));
        h = r.ok && j.ok
          ? { ok: true, model: j.model || '', modelClassify: j.modelClassify || j.model || '', provider: j.provider || 'AI 服务' }
          : { ok: false, error: j.error || `本地 AI 服务返回 ${r.status}` };
      } catch (e) {
        h = { ok: false, error: '没有连接到本地 AI 代理：请用 node simulator/server.js 启动本页，再用它给出的地址打开。' };
      }
      state.health = h;
      state.pending = null;
      if (!state.notified) {
        state.notified = true;
        if (typeof AI.onChange === 'function') setTimeout(() => AI.onChange(h), 0);
      }
      return h;
    })();
    return state.pending;
  }

  async function classify(items) {
    const r = await timeoutFetch(`${BASE}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    }, 60000);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || `AI 服务返回 ${r.status}`);
    return j;
  }

  return {
    onChange: null,
    check,
    healthInfo: () => state.health,
    classify,
    sugg: (id) => sugg.get(id) || null,
    setSugg: (id, s) => sugg.set(id, s),
    dropSugg: (id) => sugg.delete(id),
    clearSugg: () => sugg.clear(),
    get busy() { return state.busy; },
    set busy(v) { state.busy = !!v; }
  };
})();