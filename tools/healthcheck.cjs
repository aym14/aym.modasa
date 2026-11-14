const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('site/index.html', 'utf8');
let count = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
  if (/type=["']application\/json/.test(match[1])) JSON.parse(match[2]);
  else if (match[2].trim()) { new vm.Script(match[2], { filename: `inline-${++count}.js` }); }
}
new vm.Script(fs.readFileSync('site/sw.js', 'utf8'));
new vm.Script(fs.readFileSync('site/party-cloud.js', 'utf8'));
new vm.Script(fs.readFileSync('site/party-mobile-email-login.js', 'utf8'));
new vm.Script(fs.readFileSync('site/party-requests.js', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('site/manifest.json', 'utf8'));
JSON.parse(fs.readFileSync('site/licensing-config.json', 'utf8'));
for (const icon of manifest.icons) assert.ok(fs.existsSync('site/' + icon.src));
assert.match(html, /name="viewport"[^>]*width=device-width/i, 'responsive viewport metadata is required');
assert.match(html, /party_invite/, 'invite registration entry point is required');
assert.match(html, /registerPartyByInvite/, 'verified Party registration API is required');
assert.match(html, /completeInviteRegistration/, 'verified Party password setup is required');
assert.match(fs.readFileSync('site/party-cloud.js', 'utf8'), /party-requests\.js\?v=invite-registration-1/, 'request UI cache version must be explicit');
const migration = fs.readFileSync('supabase/migrations/202611140002_party_invite_self_registration.sql', 'utf8');
assert.match(migration, /security definer/i, 'registration RPC must enforce server-side authorization');
assert.match(migration, /aym_verified_email\(\)/i, 'registration RPC must require verified email');
assert.match(migration, /use_count<1/, 'each invite must be single use');
console.log(`PASS: ${count} JavaScript blocks, all JavaScript modules, responsive metadata, invite flow and manifest assets`);

// Exercise actual app functions with isolated storage and HTTP responses.
function appFunction(name) {
  const start = html.indexOf(`LedgerFeatures.cloud.${name} = `);
  assert.ok(start >= 0, name);
  const end = html.indexOf('\n};', start);
  return html.slice(start, end + 3);
}
async function regression() {
  const requests = [];
  let reply = { ok: true, json: async () => [{ updated_at: 'new' }] };
  const c = {
    LedgerFeatures: { cloud: {} }, window: {},
    cloudCfg: { supabaseAnonKey: 'new-key', supabaseSyncKey: 'main' },
    localStorage: { getItem: () => null },
    supabaseBaseUrl: () => 'https://new.example',
    supabaseEnsureAdmin: async () => ({ organizationId: 'org', user: { id: 'user' } }),
    supabaseHeaders: () => ({}),
    fetch: async (url, options) => { requests.push({ url, ...options }); return reply; }
  };
  vm.createContext(c);
  vm.runInContext(appFunction('supabaseUpsert'), c);
  const save = c.LedgerFeatures.cloud.supabaseUpsert;
  await save({ entries: [] }, '2026-11-09T00:00:00+00:00');
  assert.equal(requests[0].method, 'PATCH');
  assert.ok(requests[0].url.includes('updated_at=eq.2026-11-09T00%3A00%3A00%2B00%3A00'));
  reply = { ok: true, json: async () => [] };
  await assert.rejects(save({}, 'stale'), e => e.syncConflict === true);
  reply = { ok: false, status: 409, json: async () => ({ code: '23505' }) };
  await assert.rejects(save({}, null), e => e.syncConflict === true);
  assert.equal(requests.at(-1).method, 'POST');
  reply = { ok: false, status: 403, json: async () => ({ message: 'denied' }) };
  await assert.rejects(save({}, 'old'), e => !e.syncConflict && e.message === 'denied');
  c.LedgerFeatures.cloud.supabaseAuthState = () => c.window.aymSupabaseLedgerAuth;
  c.LedgerFeatures.cloud.supabaseSessionKey = () => 'session';
  vm.runInContext(appFunction('supabaseLoadSession'), c);
  c.window.aymSupabaseLedgerAuth = { url: 'https://old.example', key: 'old-key' };
  assert.equal(c.LedgerFeatures.cloud.supabaseLoadSession(), null);
  const valid = { url: 'https://new.example', key: 'new-key', access_token: 'test' };
  c.window.aymSupabaseLedgerAuth = valid;
  assert.equal(c.LedgerFeatures.cloud.supabaseLoadSession(), valid);
  console.log('PASS: stale writes, first-write races, permission errors and project-scoped sessions');
}
regression().catch(error => { console.error(error); process.exitCode = 1; });

async function emailRegression(){
 const start=html.indexOf('  // Email-only Party verification.');
 const end=html.indexOf('  window.AYMPO = {',start);
 assert.ok(start>0&&end>start);
 const requests=[];const saved=new Map();
 const c={URL,URLSearchParams,Date,location:{href:'https://example.com/ledger/'},S:{},localStorage:{setItem:(k,v)=>saved.set(k,v),getItem:k=>saved.get(k),removeItem:k=>saved.delete(k)},isEmail:s=>s.includes('@'),partyCandidateEmail:c=>c.user.email,normalizePhoneLoginMobile:()=>'+919000000000',btnBusy:()=>{},phoneAuthConfig:async()=>({}),phoneAuthRequest:async(cfg,path,payload)=>{requests.push({path,payload});return {};},loginText:en=>en,err:()=>{},esc:s=>s};
 c.nMail=s=>String(s||'').trim().toLowerCase();
 vm.createContext(c);vm.runInContext(html.slice(start,end),c);
 vm.runInContext('stepPhoneOtp = function(){};',c);
 await c.beginDualPartyOtp({user:{id:'party-user',role:'party',email:'party@example.com'},party:{id:'party'}},null);
 assert.equal(requests.length,1);assert.equal(requests[0].payload.email,'party@example.com');assert.ok(!('phone' in requests[0].payload));
 const auth={access_token:'x',refresh_token:'y',user:{email:'party@example.com',email_confirmed_at:'2026-11-09'}};
 assert.equal(c.partyEmailIdentity(auth,'party@example.com'),true);
 assert.equal(c.partyEmailIdentity(auth,'other@example.com'),false);
 assert.equal(c.partyEmailIdentity({...auth,user:{email:'party@example.com'}},'party@example.com'),false);
 const state={entries:[{id:'private-admin-entry'}],messages:[{private:true}]};
 Object.assign(c,{window:{},G:()=>({}),SET:(k,v)=>{state[k]=v;},savePhoneAuthSession:()=>{},close:()=>{},loginAs:(u,via)=>{assert.equal(u.role,'party');assert.equal(via,'Email Cloud');},toast:()=>{},q:()=>null});
 c.S.email='party@example.com';
 const row={organization_id:'org',sync_key:'main',party_ref:'p1',email:'party@example.com',data:{parties:[{id:'p1',name:'Own Party'}],entries:[{id:'own'}],users:[{role:'admin'}]}};
 c.adoptPartyCloud(row,auth);
 assert.equal(state.entries.length,1);assert.equal(state.entries[0].id,'own');assert.equal(state.users[0].role,'party');assert.equal(state.messages.length,0);assert.equal(c.window.aymPartyReadOnlyCloud,true);
 assert.throws(()=>c.adoptPartyCloud({...row,party_ref:'wrong'},auth),/identity mismatch/);
 console.log('PASS: email-only requests and verified-email identity matching');
}
emailRegression().catch(error=>{console.error(error);process.exitCode=1;});
