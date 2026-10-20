/**
 * ANSAR YUVA MANDAL — Smart Ledger Server
 * Zero-dependency Node.js server (no npm packages needed).
 *
 * What it does:
 *  1) Serves the Smart Ledger app (index.html in this folder) at  /
 *  2) Cloud data API (your own private "JSONBin"):
 *       GET  /api/data/:key    -> { record, updatedAt }
 *       PUT  /api/data/:key    -> body { record } ; stores whole ledger payload
 *     Protected by header  X-Access-Key: <ACCESS_TOKEN>  (set env ACCESS_TOKEN)
 *  3) Auth session endpoints the app expects for Auto-SMS:
 *       POST /api/auth/signup | /api/auth/login | /api/auth/logout
 *  4) Optional Auto-SMS relay:
 *       POST /api/sms/send     -> uses Fast2SMS when FAST2SMS_API_KEY is set,
 *                                 otherwise replies 501 (not configured).
 *
 * Run:  node server.js        (PORT env optional, default 8080)
 * Data: stored in ./data-store.json next to this file (DATA_DIR env to change).
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY || '';
const DATA_DIR = process.env.DATA_DIR || __dirname;
const STORE_FILE = path.join(DATA_DIR, 'data-store.json');
const MAX_BODY = 15 * 1024 * 1024;

/* ---------------- persistent store ---------------- */
let store = { rooms: {}, smsUsers: {} };
try {
  if (fs.existsSync(STORE_FILE)) store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  if (!store.rooms) store.rooms = {};
  if (!store.smsUsers) store.smsUsers = {};
} catch (e) { console.error('store load failed, starting fresh:', e.message); }

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const tmp = STORE_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(store));
      fs.renameSync(tmp, STORE_FILE);
    } catch (e) { console.error('store save failed:', e.message); }
  }, 150);
}

/* ---------------- helpers ---------------- */
function hashPw(pw, salt) {
  return crypto.createHash('sha256').update(String(salt) + ':' + String(pw)).digest('hex');
}
function send(res, code, obj, type) {
  const body = type === 'text' ? String(obj) : JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': type === 'text' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Access-Key, Authorization',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS'
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('Body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

/* ---------------- server ---------------- */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = decodeURIComponent(u.pathname);

  if (req.method === 'OPTIONS') { send(res, 204, {}); return; }

  try {
    if (p === '/api/health') { send(res, 200, { ok: true, app: 'smart-ledger-server', time: new Date().toISOString(), rooms: Object.keys(store.rooms).length }); return; }

    /* ---- cloud data API ---- */
    const dataMatch = p.match(/^\/api\/data\/(.+)$/);
    if (dataMatch) {
      if (ACCESS_TOKEN && req.headers['x-access-key'] !== ACCESS_TOKEN) { send(res, 401, { error: 'Invalid access token' }); return; }
      const key = dataMatch[1].slice(0, 120);
      if (req.method === 'GET') {
        const room = store.rooms[key];
        send(res, 200, room ? { record: room.data, updatedAt: room.updatedAt } : { record: null, updatedAt: 0 });
        return;
      }
      if (req.method === 'PUT') {
        const body = JSON.parse((await readBody(req)) || '{}');
        if (!body || typeof body.record !== 'object' || body.record === null) { send(res, 400, { error: 'record missing' }); return; }
        store.rooms[key] = { data: body.record, updatedAt: Date.now() };
        persist();
        send(res, 200, { ok: true, updatedAt: store.rooms[key].updatedAt });
        return;
      }
      send(res, 405, { error: 'Method not allowed' });
      return;
    }

    /* ---- auth endpoints (Auto-SMS server session) ---- */
    if (p === '/api/auth/signup' && req.method === 'POST') {
      const b = JSON.parse((await readBody(req)) || '{}');
      if (!b.username || !b.password) { send(res, 400, { error: 'username/password required' }); return; }
      if (store.smsUsers[b.username]) { send(res, 409, { error: 'User exists' }); return; }
      const salt = crypto.randomBytes(8).toString('hex');
      store.smsUsers[b.username] = {
        name: b.name || b.username, salt, passHash: hashPw(b.password, salt),
        securityQuestion: b.securityQuestion || '', securityAnswerHash: b.securityAnswer ? hashPw(String(b.securityAnswer).toLowerCase(), salt) : '',
        createdAt: new Date().toISOString()
      };
      persist();
      send(res, 200, { ok: true, success: true });
      return;
    }
    if (p === '/api/auth/login' && req.method === 'POST') {
      const b = JSON.parse((await readBody(req)) || '{}');
      const usr = store.smsUsers[b.username];
      if (!usr || usr.passHash !== hashPw(b.password || '', usr.salt)) { send(res, 401, { error: 'Invalid credentials' }); return; }
      const sid = crypto.randomBytes(16).toString('hex');
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': 'ledger_sid=' + sid + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Access-Key, Authorization',
        'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS'
      });
      res.end(JSON.stringify({ ok: true, success: true }));
      return;
    }
    if (p === '/api/auth/logout' && req.method === 'POST') { send(res, 200, { ok: true, success: true }); return; }

    /* ---- SMS relay (optional) ---- */
    if (p === '/api/sms/send' && req.method === 'POST') {
      const b = JSON.parse((await readBody(req)) || '{}');
      if (!b.to || !b.message) { send(res, 400, { error: 'to/message required' }); return; }
      if (!FAST2SMS_API_KEY) { send(res, 501, { error: 'SMS provider not configured on server (set FAST2SMS_API_KEY)' }); return; }
      const numbers = String(b.to).replace(/\D/g, '').slice(-10);
      const fr = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { authorization: FAST2SMS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: 'q', message: String(b.message).slice(0, 1000), language: 'unicode', flash: 0, numbers })
      });
      const fj = await fr.json().catch(() => ({}));
      if (!fr.ok || fj.return === false) { send(res, 502, { error: 'SMS provider: ' + (fj.message || ('HTTP ' + fr.status)) }); return; }
      send(res, 200, { ok: true, success: true, provider: 'fast2sms' });
      return;
    }

    if (p.startsWith('/api/')) { send(res, 404, { error: 'Unknown API route' }); return; }

    /* ---- static files (the app) ---- */
    if (req.method !== 'GET') { send(res, 405, { error: 'Method not allowed' }); return; }
    let rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
    const file = path.join(__dirname, rel);
    if (!file.startsWith(__dirname) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      send(res, 404, 'Not found: ' + rel, 'text');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Smart Ledger Server running on port ' + PORT);
  console.log('App:  http://localhost:' + PORT + '/');
  console.log('Data store: ' + STORE_FILE + (ACCESS_TOKEN ? ' (token protected)' : ' (WARNING: ACCESS_TOKEN not set)'));
});
