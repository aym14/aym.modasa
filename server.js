/**
 * ANSAR YUVA MANDAL — Smart Ledger server
 *
 * Serves the single-file app, an access-token-protected cloud data API, and
 * the optional Auto-SMS relay. Runtime secrets are loaded from the process
 * environment or a local (git-ignored) .env file.
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT_DIR = __dirname;
const DEFAULT_PORT = 8080;
const DEFAULT_MAX_BODY_BYTES = 15 * 1024 * 1024;
const SESSION_COOKIE = 'ledger_sid';
const DEFAULT_SESSION_TTL_SECONDS = 24 * 60 * 60;
const PUBLIC_FILES = new Set([
  'index.html',
  'manifest.json',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png'
]);
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

/** Load simple KEY=value entries without overriding explicitly exported env. */
function loadEnvFile(filePath = path.join(ROOT_DIR, '.env'), target = process.env) {
  let contents;
  try {
    contents = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {return;}
    throw error;
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) {continue;}
    if (line.startsWith('export ')) {line = line.slice(7).trim();}

    const separator = line.indexOf('=');
    if (separator < 1) {continue;}
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || target[key] !== undefined) {continue;}

    let value = line.slice(separator + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
      if (quote === '"') {
        value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    target[key] = value;
  }
}

function parseInteger(value, fallback, name, minimum, maximum) {
  if (value === undefined || value === '') {return fallback;}
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === '') {return fallback;}
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function readConfig(env = process.env) {
  const allowedOrigins = String(env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  return {
    port: parseInteger(env.PORT, DEFAULT_PORT, 'PORT', 0, 65535),
    accessToken: String(env.ACCESS_TOKEN || ''),
    fast2smsApiKey: String(env.FAST2SMS_API_KEY || ''),
    dataDir: path.resolve(ROOT_DIR, env.DATA_DIR || '.'),
    maxBodyBytes: parseInteger(env.MAX_BODY_BYTES, DEFAULT_MAX_BODY_BYTES, 'MAX_BODY_BYTES', 1024, 100 * 1024 * 1024),
    sessionTtlSeconds: parseInteger(env.SESSION_TTL_SECONDS, DEFAULT_SESSION_TTL_SECONDS, 'SESSION_TTL_SECONDS', 60, 30 * 24 * 60 * 60),
    allowedOrigins: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    publicSyncConfig: parseBoolean(env.PUBLIC_SYNC_CONFIG, false),
    cookieSecure: env.COOKIE_SECURE === undefined || env.COOKIE_SECURE === ''
      ? null
      : parseBoolean(env.COOKIE_SECURE)
  };
}

function makeHttpError(statusCode, message) {
  return new HttpError(statusCode, message);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {return false;}
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function copyMap(value) {
  const result = Object.create(null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {return result;}
  for (const [key, item] of Object.entries(value)) {result[key] = item;}
  return result;
}

function createStorage(dataDir) {
  const storeFile = path.join(dataDir, 'data-store.json');
  const store = { rooms: Object.create(null), smsUsers: Object.create(null) };
  let saveTimer = null;
  let dirty = false;

  try {
    if (fs.existsSync(storeFile)) {
      const loaded = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
      if (loaded && typeof loaded === 'object') {
        store.rooms = copyMap(loaded.rooms);
        store.smsUsers = copyMap(loaded.smsUsers);
      }
    }
  } catch (error) {
    console.error('Store load failed; starting with an empty store:', error.message);
  }

  function flush() {
    if (!dirty) {return;}
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    try {
      fs.mkdirSync(dataDir, { recursive: true });
      const temporaryFile = `${storeFile}.${process.pid}.tmp`;
      fs.writeFileSync(temporaryFile, JSON.stringify(store), { mode: 0o600 });
      fs.renameSync(temporaryFile, storeFile);
      try {
        fs.chmodSync(storeFile, 0o600);
      } catch (_) {
        // File permissions are best-effort on platforms that do not support them.
      }
      dirty = false;
    } catch (error) {
      console.error('Store save failed:', error.message);
    }
  }

  function scheduleSave() {
    dirty = true;
    if (saveTimer) {clearTimeout(saveTimer);}
    saveTimer = setTimeout(flush, 150);
    if (typeof saveTimer.unref === 'function') {saveTimer.unref();}
  }

  return {
    store,
    scheduleSave,
    flush,
    close: flush,
    storeFile
  };
}

function scryptHash(secret, salt = crypto.randomBytes(16).toString('hex')) {
  const digest = crypto.scryptSync(String(secret), salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024
  });
  return { salt, passHash: `scrypt$${digest.toString('hex')}` };
}

function legacyPasswordHash(password, salt) {
  return crypto.createHash('sha256').update(`${String(salt)}:${String(password)}`).digest('hex');
}

function safeHexEqual(left, right) {
  if (!/^[a-f\d]+$/i.test(left) || !/^[a-f\d]+$/i.test(right) || left.length !== right.length || left.length % 2 !== 0) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

/** Validate current scrypt hashes and transparently upgrade legacy SHA-256. */
function verifyPassword(password, user) {
  if (!user || typeof user.salt !== 'string' || typeof user.passHash !== 'string') {
    return { valid: false, upgraded: false };
  }

  if (user.passHash.startsWith('scrypt$')) {
    const expected = user.passHash.slice('scrypt$'.length);
    const actual = crypto.scryptSync(String(password), user.salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024
    }).toString('hex');
    return { valid: safeHexEqual(actual, expected), upgraded: false };
  }

  const expected = legacyPasswordHash(password, user.salt);
  if (!safeHexEqual(expected, user.passHash)) {return { valid: false, upgraded: false };}
  Object.assign(user, scryptHash(password));
  return { valid: true, upgraded: true };
}

function safeTokenEqual(provided, expected) {
  if (!expected || typeof provided !== 'string') {return false;}
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && crypto.timingSafeEqual(providedBytes, expectedBytes);
}

function corsHeaders(req, config) {
  const headers = {
    'Access-Control-Allow-Headers': 'Content-Type, X-Access-Key, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };
  const origin = req.headers.origin;
  const allowed = config.allowedOrigins === '*' || (Array.isArray(config.allowedOrigins) && config.allowedOrigins.includes(origin));
  if (origin && allowed) {
    headers['Access-Control-Allow-Origin'] = config.allowedOrigins === '*' ? '*' : origin;
    if (config.allowedOrigins !== '*') {headers.Vary = 'Origin';}
  }
  return headers;
}

function send(req, res, statusCode, payload, config, options = {}) {
  const noContent = statusCode === 204 || statusCode === 304;
  const isText = options.type === 'text';
  const body = noContent ? '' : isText ? String(payload ?? '') : JSON.stringify(payload ?? {});
  const headers = {
    ...corsHeaders(req, config),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': options.cacheControl || 'no-store',
    ...options.headers
  };
  if (!noContent) {headers['Content-Type'] = isText ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8';}
  res.writeHead(statusCode, headers);
  res.end(body);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const contentLength = Number(req.headers['content-length']);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      req.resume();
      reject(makeHttpError(413, 'Request body too large'));
      return;
    }

    let size = 0;
    let tooLarge = false;
    const chunks = [];

    req.on('data', chunk => {
      if (tooLarge) {return;}
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(makeHttpError(413, 'Request body too large'));
        return;
      }
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('aborted', () => reject(makeHttpError(400, 'Request was interrupted')));
    req.on('error', reject);
  });
}

async function readJson(req, maxBytes) {
  const raw = await readBody(req, maxBytes);
  if (!raw.trim()) {return {};}
  try {
    return JSON.parse(raw);
  } catch (_) {
    throw makeHttpError(400, 'Request body must be valid JSON');
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const item of header.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) {continue;}
    if (item.slice(0, separator).trim() !== name) {continue;}
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch (_) {
      return '';
    }
  }
  return '';
}

function makeCookie(req, config, value, maxAgeSeconds) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];
  const secure = config.cookieSecure === null
    ? Boolean(req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https')
    : config.cookieSecure;
  if (secure) {parts.push('Secure');}
  return parts.join('; ');
}

function validUsername(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120 && !/[\u0000-\u001f\u007f]/.test(value);
}

function validDataKey(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value);
}

function staticFile(pathname, config) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const explicitlyEnabledSyncConfig = relativePath === 'sync-config.json' && config.publicSyncConfig;
  if (!PUBLIC_FILES.has(relativePath) && !explicitlyEnabledSyncConfig) {return null;}
  const resolved = path.resolve(ROOT_DIR, relativePath);
  if (!resolved.startsWith(`${ROOT_DIR}${path.sep}`)) {return null;}
  return resolved;
}

function serveStatic(req, res, pathname, config) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(req, res, 405, { error: 'Method not allowed' }, config, {
      headers: { Allow: 'GET, HEAD, OPTIONS' }
    });
    return;
  }

  const file = staticFile(pathname, config);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    send(req, res, 404, { error: 'Not found' }, config);
    return;
  }

  const extension = path.extname(file).toLowerCase();
  const headers = {
    'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=86400',
    ...corsHeaders(req, config)
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = fs.createReadStream(file);
  stream.on('error', error => {
    console.error('Static file read failed:', error.message);
    if (!res.headersSent) {send(req, res, 500, { error: 'Unable to read file' }, config);}
    else {res.destroy(error);}
  });
  stream.pipe(res);
}

function createServer(overrides = {}) {
  const config = { ...readConfig(), ...overrides };
  config.dataDir = path.resolve(config.dataDir || ROOT_DIR);
  config.maxBodyBytes = Number(config.maxBodyBytes || DEFAULT_MAX_BODY_BYTES);
  config.sessionTtlSeconds = Number(config.sessionTtlSeconds || DEFAULT_SESSION_TTL_SECONDS);
  config.allowedOrigins = config.allowedOrigins === '*' || config.allowedOrigins === undefined
    ? '*'
    : Array.isArray(config.allowedOrigins)
      ? config.allowedOrigins
      : String(config.allowedOrigins).split(',').map(origin => origin.trim()).filter(Boolean);

  const storage = createStorage(config.dataDir);
  const sessions = new Map();

  async function handle(req, res) {
    let pathname;
    try {
      const requestUrl = new URL(req.url, 'http://smart-ledger.local');
      pathname = decodeURIComponent(requestUrl.pathname);
    } catch (_) {
      send(req, res, 400, { error: 'Malformed URL' }, config);
      return;
    }

    if (req.method === 'OPTIONS') {
      send(req, res, 204, null, config);
      return;
    }

    if (pathname === '/api/health') {
      send(req, res, 200, {
        ok: true,
        app: 'smart-ledger-server',
        time: new Date().toISOString(),
        rooms: Object.keys(storage.store.rooms).length
      }, config);
      return;
    }

    const dataMatch = pathname.match(/^\/api\/data\/([^/]+)$/);
    if (dataMatch) {
      if (!config.accessToken) {
        send(req, res, 503, { error: 'Data API is disabled; configure ACCESS_TOKEN on the server' }, config);
        return;
      }
      if (!safeTokenEqual(req.headers['x-access-key'], config.accessToken)) {
        send(req, res, 401, { error: 'Invalid access token' }, config);
        return;
      }
      const key = dataMatch[1];
      if (!validDataKey(key)) {
        send(req, res, 400, { error: 'Invalid data key' }, config);
        return;
      }

      if (req.method === 'GET') {
        const room = Object.prototype.hasOwnProperty.call(storage.store.rooms, key) ? storage.store.rooms[key] : null;
        send(req, res, 200, room ? { record: room.data, updatedAt: room.updatedAt } : { record: null, updatedAt: 0 }, config);
        return;
      }

      if (req.method === 'POST' || req.method === 'PUT') {
        const body = await readJson(req, config.maxBodyBytes);
        if (!isPlainObject(body) || !isPlainObject(body.record)) {
          send(req, res, 400, { error: 'record must be a JSON object' }, config);
          return;
        }
        const exists = Object.prototype.hasOwnProperty.call(storage.store.rooms, key);
        if (req.method === 'POST' && exists) {
          send(req, res, 409, { error: 'Record already exists' }, config);
          return;
        }
        const updatedAt = Date.now();
        storage.store.rooms[key] = { data: body.record, updatedAt };
        storage.scheduleSave();
        send(req, res, req.method === 'POST' ? 201 : 200, { ok: true, created: !exists, updatedAt }, config);
        return;
      }

      if (req.method === 'DELETE') {
        const existed = Object.prototype.hasOwnProperty.call(storage.store.rooms, key);
        if (existed) {
          delete storage.store.rooms[key];
          storage.scheduleSave();
        }
        send(req, res, 200, { ok: true, deleted: existed }, config);
        return;
      }

      send(req, res, 405, { error: 'Method not allowed' }, config, {
        headers: { Allow: 'GET, POST, PUT, DELETE, OPTIONS' }
      });
      return;
    }

    if (pathname === '/api/auth/signup') {
      if (req.method !== 'POST') {
        send(req, res, 405, { error: 'Method not allowed' }, config, { headers: { Allow: 'POST, OPTIONS' } });
        return;
      }
      if (!config.accessToken) {
        send(req, res, 503, { error: 'Account registration is disabled; configure ACCESS_TOKEN on the server' }, config);
        return;
      }
      if (!safeTokenEqual(req.headers['x-access-key'], config.accessToken)) {
        send(req, res, 401, { error: 'Invalid setup token' }, config);
        return;
      }
      const body = await readJson(req, config.maxBodyBytes);
      if (!isPlainObject(body)) {
        send(req, res, 400, { error: 'Request body must be a JSON object' }, config);
        return;
      }
      if (!validUsername(body.username) || typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 512) {
        send(req, res, 400, { error: 'A valid username and password (8–512 characters) are required' }, config);
        return;
      }
      const username = body.username.trim();
      if (Object.prototype.hasOwnProperty.call(storage.store.smsUsers, username)) {
        send(req, res, 409, { error: 'User exists' }, config);
        return;
      }

      const password = scryptHash(body.password);
      const answer = typeof body.securityAnswer === 'string' ? body.securityAnswer.trim().toLowerCase().slice(0, 250) : '';
      const answerHash = answer ? scryptHash(answer) : null;
      storage.store.smsUsers[username] = {
        name: typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 160) : username,
        salt: password.salt,
        passHash: password.passHash,
        securityQuestion: typeof body.securityQuestion === 'string' ? body.securityQuestion.trim().slice(0, 250) : '',
        securityAnswerSalt: answerHash ? answerHash.salt : '',
        securityAnswerHash: answerHash ? answerHash.passHash : '',
        createdAt: new Date().toISOString()
      };
      storage.scheduleSave();
      send(req, res, 201, { ok: true, success: true }, config);
      return;
    }

    if (pathname === '/api/auth/login') {
      if (req.method !== 'POST') {
        send(req, res, 405, { error: 'Method not allowed' }, config, { headers: { Allow: 'POST, OPTIONS' } });
        return;
      }
      const body = await readJson(req, config.maxBodyBytes);
      if (!isPlainObject(body)) {
        send(req, res, 400, { error: 'Request body must be a JSON object' }, config);
        return;
      }
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const user = Object.prototype.hasOwnProperty.call(storage.store.smsUsers, username)
        ? storage.store.smsUsers[username]
        : null;
      const result = user && typeof body.password === 'string'
        ? verifyPassword(body.password, user)
        : { valid: false, upgraded: false };
      if (!result.valid) {
        send(req, res, 401, { error: 'Invalid credentials' }, config);
        return;
      }
      if (result.upgraded) {storage.scheduleSave();}

      const sessionId = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + config.sessionTtlSeconds * 1000;
      sessions.set(sessionId, { username, expiresAt });
      for (const [id, session] of sessions) {
        if (session.expiresAt <= Date.now()) {sessions.delete(id);}
      }
      send(req, res, 200, { ok: true, success: true }, config, {
        headers: { 'Set-Cookie': makeCookie(req, config, sessionId, config.sessionTtlSeconds) }
      });
      return;
    }

    if (pathname === '/api/auth/logout') {
      if (req.method !== 'POST') {
        send(req, res, 405, { error: 'Method not allowed' }, config, { headers: { Allow: 'POST, OPTIONS' } });
        return;
      }
      const sessionId = readCookie(req, SESSION_COOKIE);
      if (sessionId) {sessions.delete(sessionId);}
      send(req, res, 200, { ok: true, success: true }, config, {
        headers: { 'Set-Cookie': makeCookie(req, config, '', 0) }
      });
      return;
    }

    if (pathname === '/api/sms/send') {
      if (req.method !== 'POST') {
        send(req, res, 405, { error: 'Method not allowed' }, config, { headers: { Allow: 'POST, OPTIONS' } });
        return;
      }
      const sessionId = readCookie(req, SESSION_COOKIE);
      const session = sessions.get(sessionId);
      if (!session || session.expiresAt <= Date.now()) {
        if (sessionId) {sessions.delete(sessionId);}
        send(req, res, 401, { error: 'Authentication required' }, config);
        return;
      }

      const body = await readJson(req, config.maxBodyBytes);
      if (!isPlainObject(body)) {
        send(req, res, 400, { error: 'Request body must be a JSON object' }, config);
        return;
      }
      if (typeof body.to !== 'string' || typeof body.message !== 'string' || !body.message.trim()) {
        send(req, res, 400, { error: 'to and message are required' }, config);
        return;
      }
      const numbers = body.to.replace(/\D/g, '').slice(-10);
      if (!/^[6-9]\d{9}$/.test(numbers)) {
        send(req, res, 400, { error: 'A valid Indian mobile number is required' }, config);
        return;
      }
      if (!config.fast2smsApiKey) {
        send(req, res, 501, { error: 'SMS provider is not configured on the server' }, config);
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const providerResponse = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: config.fast2smsApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            route: 'q',
            message: body.message.slice(0, 1000),
            language: 'unicode',
            flash: 0,
            numbers
          }),
          signal: controller.signal
        });
        const providerBody = await providerResponse.json().catch(() => ({}));
        if (!providerResponse.ok || providerBody.return === false) {
          send(req, res, 502, { error: 'SMS provider rejected the request' }, config);
          return;
        }
        send(req, res, 200, { ok: true, success: true, provider: 'fast2sms' }, config);
      } catch (error) {
        const timedOut = error.name === 'AbortError';
        send(req, res, timedOut ? 504 : 502, { error: timedOut ? 'SMS provider timed out' : 'Unable to reach SMS provider' }, config);
      } finally {
        clearTimeout(timeout);
      }
      return;
    }

    if (pathname.startsWith('/api/')) {
      send(req, res, 404, { error: 'Unknown API route' }, config);
      return;
    }

    serveStatic(req, res, pathname, config);
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(error => {
      if (res.headersSent) {
        res.destroy(error);
        return;
      }
      const statusCode = error instanceof HttpError ? error.statusCode : 500;
      if (statusCode === 500) {console.error('Request failed:', error.message);}
      send(req, res, statusCode, {
        error: statusCode === 500 ? 'Internal server error' : error.message
      }, config);
    });
  });

  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  server.on('close', storage.close);
  return server;
}

loadEnvFile();

if (require.main === module) {
  const config = readConfig();
  const server = createServer(config);
  server.listen(config.port, '0.0.0.0', () => {
    console.log(`Smart Ledger server running on port ${config.port}`);
    console.log(`App: http://localhost:${config.port}/`);
    console.log(`Data store: ${path.join(config.dataDir, 'data-store.json')}`);
    console.log(config.accessToken
      ? 'Cloud data API: access-token protected'
      : 'Cloud data API: disabled (set ACCESS_TOKEN in .env to enable)');
  });

  let shuttingDown = false;
  function shutdown() {
    if (shuttingDown) {return;}
    shuttingDown = true;
    server.close(error => {
      if (error) {
        console.error('Server shutdown failed:', error.message);
        process.exitCode = 1;
      }
    });
    const forceExit = setTimeout(() => {
      console.error('Graceful shutdown timed out');
      process.exit(1);
    }, 10_000);
    forceExit.unref();
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  createServer,
  loadEnvFile,
  readConfig,
  staticFile,
  scryptHash,
  legacyPasswordHash,
  verifyPassword
};
