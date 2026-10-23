'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const {
  createServer,
  staticFile,
  legacyPasswordHash,
  loadEnvFile,
  verifyPassword
} = require('../server.js');

const activeServers = new Set();

after(async () => {
  await Promise.all([...activeServers].map(closeServer));
});

async function startServer(overrides = {}) {
  const dataDir = overrides.dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'smart-ledger-test-'));
  const server = createServer({
    accessToken: 'unit-test-access-token',
    allowedOrigins: ['https://app.example.test'],
    dataDir,
    ...overrides
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const context = {
    server,
    dataDir,
    url: `http://127.0.0.1:${address.port}`
  };
  activeServers.add(context);
  return context;
}

async function closeServer(context) {
  if (!activeServers.has(context)) {return;}
  activeServers.delete(context);
  await new Promise(resolve => {
    context.server.close(() => resolve());
    if (typeof context.server.closeAllConnections === 'function') {
      context.server.closeAllConnections();
    }
  });
}

async function cleanServer(context) {
  await closeServer(context);
  fs.rmSync(context.dataDir, { recursive: true, force: true });
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (_) {
      body = { raw: text };
    }
  }
  return { response, body };
}

function dataHeaders(token = 'unit-test-access-token') {
  return {
    'Content-Type': 'application/json',
    'X-Access-Key': token
  };
}

test('cloud data API fails closed when ACCESS_TOKEN is not configured', async () => {
  const context = await startServer({ accessToken: '' });
  try {
    const { response, body } = await requestJson(`${context.url}/api/data/ledger`);
    assert.equal(response.status, 503);
    assert.match(body.error, /ACCESS_TOKEN/);

    const registration = await requestJson(`${context.url}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Ledger-Test-Password-2026' })
    });
    assert.equal(registration.response.status, 503);
  } finally {
    await cleanServer(context);
  }
});

test('cloud data API supports protected create, read, update, and delete', async () => {
  const context = await startServer();
  const endpoint = `${context.url}/api/data/ledger-2026`;
  try {
    const unauthorized = await requestJson(endpoint);
    assert.equal(unauthorized.response.status, 401);

    const created = await requestJson(endpoint, {
      method: 'POST',
      headers: dataHeaders(),
      body: JSON.stringify({ record: { entries: [{ id: 'entry-1', amount: 100 }] } })
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.created, true);

    const duplicate = await requestJson(endpoint, {
      method: 'POST',
      headers: dataHeaders(),
      body: JSON.stringify({ record: { entries: [] } })
    });
    assert.equal(duplicate.response.status, 409);

    const read = await requestJson(endpoint, { headers: dataHeaders() });
    assert.deepEqual(read.body.record, { entries: [{ id: 'entry-1', amount: 100 }] });

    const updated = await requestJson(endpoint, {
      method: 'PUT',
      headers: dataHeaders(),
      body: JSON.stringify({ record: { entries: [{ id: 'entry-1', amount: 125 }] } })
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.created, false);

    const afterUpdate = await requestJson(endpoint, { headers: dataHeaders() });
    assert.equal(afterUpdate.body.record.entries[0].amount, 125);

    const deleted = await requestJson(endpoint, { method: 'DELETE', headers: dataHeaders() });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.body.deleted, true);

    const afterDelete = await requestJson(endpoint, { headers: dataHeaders() });
    assert.equal(afterDelete.body.record, null);

    const unsafeKey = await requestJson(`${context.url}/api/data/__proto__`, { headers: dataHeaders() });
    assert.equal(unsafeKey.response.status, 400);
  } finally {
    await cleanServer(context);
  }
});

test('data API rejects malformed JSON, non-object records, and oversized requests', async () => {
  const context = await startServer({ maxBodyBytes: 1024 });
  const endpoint = `${context.url}/api/data/ledger`;
  try {
    const malformed = await requestJson(endpoint, {
      method: 'PUT',
      headers: dataHeaders(),
      body: '{bad json'
    });
    assert.equal(malformed.response.status, 400);
    assert.match(malformed.body.error, /valid JSON/);

    const arrayRecord = await requestJson(endpoint, {
      method: 'PUT',
      headers: dataHeaders(),
      body: JSON.stringify({ record: [] })
    });
    assert.equal(arrayRecord.response.status, 400);

    const tooLarge = await requestJson(endpoint, {
      method: 'PUT',
      headers: dataHeaders(),
      body: JSON.stringify({ record: { payload: 'x'.repeat(2048) } })
    });
    assert.equal(tooLarge.response.status, 413);
  } finally {
    await cleanServer(context);
  }
});

test('public assets are served but local secrets and source files are not', async () => {
  const context = await startServer();
  try {
    const home = await fetch(`${context.url}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type'), /text\/html/);
    assert.match(await home.text(), /Smart Ledger/);

    const manifest = await fetch(`${context.url}/manifest.json`);
    assert.equal(manifest.status, 200);
    assert.match(manifest.headers.get('x-content-type-options'), /nosniff/);

    for (const file of ['/.env', '/server.js', '/package.json', '/sync-config.json', '/data-store.json']) {
      const response = await fetch(`${context.url}${file}`);
      assert.equal(response.status, 404, `${file} should not be public`);
    }
  } finally {
    await cleanServer(context);
  }
});

test('sync-config.json requires an explicit public opt-in', () => {
  assert.equal(staticFile('/sync-config.json', { publicSyncConfig: false }), null);
  assert.equal(
    staticFile('/sync-config.json', { publicSyncConfig: true }),
    path.join(__dirname, '..', 'sync-config.json')
  );
});

test('CORS preflight honors configured origins and advertises CRUD methods', async () => {
  const context = await startServer();
  try {
    const allowed = await fetch(`${context.url}/api/data/ledger`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.test', 'Access-Control-Request-Method': 'DELETE' }
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.example.test');
    assert.match(allowed.headers.get('access-control-allow-methods'), /DELETE/);

    const denied = await fetch(`${context.url}/api/data/ledger`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://untrusted.example.test' }
    });
    assert.equal(denied.status, 204);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  } finally {
    await cleanServer(context);
  }
});

test('Auto-SMS requires an authenticated, valid server session and logout revokes it', async () => {
  const context = await startServer({ fast2smsApiKey: '' });
  const smsEndpoint = `${context.url}/api/sms/send`;
  try {
    const body = JSON.stringify({ to: '+919876543210', message: 'Test' });
    const anonymous = await requestJson(smsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    assert.equal(anonymous.response.status, 401);

    const untrustedSignup = await requestJson(`${context.url}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'attacker', password: 'Long-Enough-Password-2026' })
    });
    assert.equal(untrustedSignup.response.status, 401);

    const shortPassword = await requestJson(`${context.url}/api/auth/signup`, {
      method: 'POST',
      headers: dataHeaders(),
      body: JSON.stringify({ username: 'admin', password: 'short' })
    });
    assert.equal(shortPassword.response.status, 400);

    const signup = await requestJson(`${context.url}/api/auth/signup`, {
      method: 'POST',
      headers: dataHeaders(),
      body: JSON.stringify({ username: 'admin', password: 'Ledger-Test-Password-2026' })
    });
    assert.equal(signup.response.status, 201);

    const nullLogin = await requestJson(`${context.url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    });
    assert.equal(nullLogin.response.status, 400);

    const badLogin = await requestJson(`${context.url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong-password' })
    });
    assert.equal(badLogin.response.status, 401);

    const login = await requestJson(`${context.url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Ledger-Test-Password-2026' })
    });
    assert.equal(login.response.status, 200);
    const setCookie = login.response.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    const cookie = setCookie.split(';')[0];

    const nullSmsBody = await requestJson(smsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: 'null'
    });
    assert.equal(nullSmsBody.response.status, 400);

    const authenticated = await requestJson(smsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body
    });
    assert.equal(authenticated.response.status, 501);
    assert.match(authenticated.body.error, /not configured/);

    const logout = await requestJson(`${context.url}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie }
    });
    assert.equal(logout.response.status, 200);
    assert.match(logout.response.headers.get('set-cookie'), /Max-Age=0/);

    const revoked = await requestJson(smsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body
    });
    assert.equal(revoked.response.status, 401);
  } finally {
    await cleanServer(context);
  }
});

test('legacy server passwords are upgraded to scrypt after a valid login', () => {
  const user = {
    salt: 'legacy-salt',
    passHash: legacyPasswordHash('old-secret', 'legacy-salt')
  };
  const result = verifyPassword('old-secret', user);
  assert.deepEqual(result, { valid: true, upgraded: true });
  assert.match(user.passHash, /^scrypt\$/);
  assert.equal(verifyPassword('incorrect', user).valid, false);
});

test('writes are persisted atomically and loaded on server restart', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-ledger-persist-'));
  const first = await startServer({ dataDir });
  try {
    const saved = await requestJson(`${first.url}/api/data/persisted`, {
      method: 'PUT',
      headers: dataHeaders(),
      body: JSON.stringify({ record: { entries: [{ id: 'saved-entry' }] } })
    });
    assert.equal(saved.response.status, 200);
  } finally {
    await closeServer(first);
  }

  const second = await startServer({ dataDir });
  try {
    const loaded = await requestJson(`${second.url}/api/data/persisted`, { headers: dataHeaders() });
    assert.equal(loaded.body.record.entries[0].id, 'saved-entry');
    const storeFile = path.join(dataDir, 'data-store.json');
    assert.equal(fs.existsSync(storeFile), true);
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(storeFile).mode & 0o777, 0o600);
    }
  } finally {
    await cleanServer(second);
  }
});

test('dotenv loader respects exported values and parses comments and quoted values', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-ledger-env-'));
  const envFile = path.join(directory, '.env');
  const target = { PORT: '9000' };
  fs.writeFileSync(envFile, [
    '# comment',
    'PORT=8080',
    'ACCESS_TOKEN=local-secret # trailing note',
    'FAST2SMS_API_KEY="value#with-hash"',
    'export DATA_DIR=./private-data',
    'not a valid line'
  ].join('\n'));
  try {
    loadEnvFile(envFile, target);
    assert.equal(target.PORT, '9000');
    assert.equal(target.ACCESS_TOKEN, 'local-secret');
    assert.equal(target.FAST2SMS_API_KEY, 'value#with-hash');
    assert.equal(target.DATA_DIR, './private-data');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
