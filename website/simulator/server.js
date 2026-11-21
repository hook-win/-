'use strict';
/* 模拟银行消费流水实时推送服务(零依赖)。
   同时静态托管上级目录的生活费管家网页,打开 http://localhost:3000 即完成接入。 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { transactions } = require('./data.js');
const ai = require('./ai.js');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, '..');
const TOTAL = transactions.length;

const player = { playing: true, speed: 1500, cursor: 0 };
const clients = new Set();
let timer = null;

const statusPayload = () => ({
  playing: player.playing,
  speed: player.speed,
  cursor: player.cursor,
  total: TOTAL,
  done: player.cursor >= TOTAL
});

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

function scheduleNext() {
  clearTimeout(timer);
  if (!player.playing || player.cursor >= TOTAL) return;
  timer = setTimeout(() => {
    const tx = transactions[player.cursor];
    player.cursor++;
    if (player.cursor >= TOTAL) player.playing = false;
    broadcast('transaction', tx);
    broadcast('status', statusPayload());
    scheduleNext();
  }, player.speed);
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); } });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8'
};

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel === '/') rel = '/index.html';
  // 不暴露 .env / .gitignore 等隐藏文件(API Key 就写在 .env 里)
  if (rel.split(/[\\/]/).some((seg) => seg.startsWith('.'))) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not Found');
  }
  const file = path.normalize(path.join(ROOT, rel));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not Found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (p === '/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    const all = u.searchParams.get('history') === 'all';
    const recent = all
      ? transactions
      : transactions.slice(Math.max(0, player.cursor - 5), player.cursor);
    res.write(`event: ready\ndata: ${JSON.stringify({ recent, status: statusPayload(), history: all ? 'all' : 'recent' })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (p === '/player/status' && req.method === 'GET') return sendJSON(res, 200, statusPayload());

  if (p === '/player/control' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.speed != null) {
      const sp = Number(body.speed);
      if (isFinite(sp)) player.speed = Math.min(10000, Math.max(100, Math.round(sp)));
    }
    if (body.action === 'pause') { player.playing = false; clearTimeout(timer); }
    else if (body.action === 'play') {
      if (player.cursor >= TOTAL) player.cursor = 0;
      player.playing = true;
      scheduleNext();
    } else if (body.action === 'reset') {
      player.cursor = 0;
      player.playing = true;
      scheduleNext();
    }
    broadcast('status', statusPayload());
    return sendJSON(res, 200, statusPayload());
  }

  if (p === '/transactions/emit' && req.method === 'POST') {
    const body = await readBody(req);
    const tx = body.transaction || transactions[Number(body.index)];
    if (!tx) return sendJSON(res, 400, { error: 'index 越界或缺少 transaction' });
    broadcast('transaction', tx);
    return sendJSON(res, 200, { emitted: tx.id || null });
  }

  if (p === '/transactions/recent' && req.method === 'GET') {
    const n = Math.min(20, Math.max(1, Number(u.searchParams.get('n')) || 5));
    return sendJSON(res, 200, transactions.slice(Math.max(0, player.cursor - n), player.cursor));
  }

  if (p === '/transactions/all' && req.method === 'GET') return sendJSON(res, 200, transactions);

  /* ---------- AI 代理(Key 只在服务端) ---------- */
  if (p === '/api/ai/health' && req.method === 'GET') return sendJSON(res, 200, ai.health());

  if (p === '/api/ai/classify' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const out = await ai.classify(body.items);
      console.log(`[ai] 猜分类 ${out.total} 笔(缓存命中 ${out.cached})`);
      return sendJSON(res, 200, out);
    } catch (e) {
      console.error('[ai] 猜分类失败:', e.message);
      return sendJSON(res, e.status || 502, { error: e.message });
    }
  }

  if (req.method === 'GET') return serveStatic(req, res, p);

  sendJSON(res, 405, { error: 'Method Not Allowed' });
});

setInterval(() => { for (const res of clients) res.write(': hb\n\n'); }, 15000);

scheduleNext();
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用(可能队友的模拟流水服务正在运行)。`);
    console.error(`若只需托管网页,请用其他端口启动:PORT=3001 node simulator/server.js`);
    process.exit(1);
  }
  throw err;
});
server.listen(PORT, () => {
  console.log(`模拟流水服务已启动:http://localhost:${PORT}`);
  console.log(`共 ${TOTAL} 笔交易,自动播放中,每笔间隔 ${player.speed}ms`);
  const h = ai.health();
  if (h.ok) console.log(`AI 服务已就绪:${h.modelClassify}(猜分类) · Key 来源 ${h.keySource}`);
  else console.log(`AI 服务未启用:${h.error}`);
});