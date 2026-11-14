// Regression tests for the Supabase Edge Functions (mocked network, no Deno needed).
// Run: node tools/edge-functions.test.mjs   (Node 22.7+)
import { stripTypeScriptTypes } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc', SUPABASE_ANON_KEY: 'pub' };
let handler; let sentOtp = 0; let accountExists = false;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
const rows = [{ organization_id: 'o1', party_ref: 'p1', email: 'a@b.in', parties: [{ id: 'p1', mobile: '+919999999999', email: 'a@b.in' }] }];
globalThis.fetch = async (u) => {
  if (u.includes('/auth/v1/otp')) { sentOtp++; return new Response('{}'); }
  if (u.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: 'u1', email: 'a@b.in', email_confirmed_at: 'x' }));
  if (u.includes('aym_party_portal')) return new Response(JSON.stringify(rows));
  if (u.includes('aym_cloud_ledger_snapshots')) return new Response('[]');
  if (u.includes('aym_party_password_accounts?select')) return new Response(JSON.stringify(accountExists ? [{ auth_user_id: 'au1' }] : []));
  if (u.includes('/auth/v1/admin/users')) return new Response(JSON.stringify({ id: 'au1' }));
  if (u.includes('/auth/v1/token')) return new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: 'au1', app_metadata: { aym_party_login: true } } }));
  return new Response('', { status: 201 });
};
async function load(name) {
  const src = stripTypeScriptTypes(fs.readFileSync(path.join(root, 'supabase/functions', name, 'index.ts'), 'utf8'));
  const file = path.join(root, `.tmp-${name}.mjs`);
  fs.writeFileSync(file, src);
  try { await import(file + '?' + Math.random()); } finally { fs.unlinkSync(file); }
  return handler;
}
const post = (h, body, headers = {}) => h(new Request('https://f/', { method: 'POST', headers: { 'x-forwarded-for': '9.9.9.9', ...headers }, body: JSON.stringify(body) }));

let h = await load('party-mobile-email-otp');
let r = await post(h, { action: 'send', mobile: '9999999999' });
assert.equal(r.status, 200); assert.equal(sentOtp, 1);
r = await post(h, { action: 'send', mobile: '8888888888' });
assert.equal(r.status, 200); assert.equal(sentOtp, 1, 'unknown number must not trigger an email');
assert.deepEqual(await r.json(), { ok: true }, 'no phone-number enumeration');
for (let i = 0; i < 6; i++) r = await post(h, { action: 'send', mobile: '9999999999' });
assert.equal(r.status, 429, 'OTP send is rate limited');
console.log('PASS: OTP function (generic reply, rate limit)');

h = await load('party-password-auth');
r = await post(h, { action: 'set_password', mobile: '9999999999', password: '12345678' }, { authorization: 'Bearer t' });
assert.equal(r.status, 200, 'set_password with 8 chars works');
r = await post(h, { action: 'set_password', mobile: '9999999999', password: '123456' }, { authorization: 'Bearer t' });
assert.equal(r.status, 400, 'new passwords shorter than 8 are refused');
accountExists = true;
r = await post(h, { action: 'login', email: 'a@b.in', password: '12345678' });
assert.equal(r.status, 200, 'login must work (regression: TDZ ReferenceError)');
r = await post(h, { action: 'login', email: 'nobody@b.in', password: '12345678' });
assert.equal(r.status, 401); assert.equal((await r.json()).error, 'invalid_party_credentials');
for (let i = 0; i < 12; i++) r = await post(h, { action: 'login', email: 'a@b.in', password: 'wrong-pass' });
assert.equal(r.status, 429, 'login is rate limited');
console.log('PASS: password function (login, set_password, enumeration, rate limit)');
