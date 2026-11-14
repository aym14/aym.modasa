const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function envKey(name: string): string {
  const raw = Deno.env.get(name) || '';
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : String(parsed.default || '');
  } catch (_) { return raw; }
}

function digits(value: unknown): string { return String(value || '').replace(/\D/g, ''); }
function mobile10(value: unknown): string {
  const d = digits(value);
  return d.length >= 10 ? d.slice(-10) : '';
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
type Target = { organization_id: string; party_ref: string; email: string; mobile: string };

async function findTarget(url: string, serviceKey: string, mobile: string, verifiedEmail?: string): Promise<Target[]> {
  const found = new Map<string, Target>();
  for (let offset = 0; offset < 10000; offset += 500) {
    const response = await fetch(url + '/rest/v1/aym_party_portal?select=organization_id,party_ref,email,data&limit=500', {
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, Range: offset + '-' + (offset + 499), 'Range-Unit': 'items' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('party_lookup_failed');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('party_lookup_failed');
    for (const row of rows) {
      const parties = row?.data?.parties;
      if (!Array.isArray(parties)) continue;
      for (const party of parties) {
        if (mobile10(party?.mobile) !== mobile) continue;
        const email = String(party?.email || '').trim().toLowerCase();
        if (!email || email !== String(row.email || '').trim().toLowerCase() || (verifiedEmail && email !== verifiedEmail)) continue;
        const ref = String(party?.id || '');
        if (!ref || ref !== String(row.party_ref || '')) continue;
        const key = String(row.organization_id) + ':' + ref;
        found.set(key, { organization_id: String(row.organization_id), party_ref: ref, email, mobile: '+91' + mobile });
      }
    }
    if (rows.length < 500) break;
  }
  return Array.from(found.values());
}

async function partyAlias(target: Target): Promise<string> {
  const input = new TextEncoder().encode(target.organization_id + ':' + target.party_ref);
  const digest = await crypto.subtle.digest('SHA-256', input);
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return 'party-' + hex.slice(0, 32) + '@login.aym.invalid';
}

async function authAdmin(url: string, serviceKey: string, method: string, path: string, body?: unknown) {
  const response = await fetch(url + '/auth/v1/admin/users' + path, {
    method,
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error('party_auth_update_failed');
  return data;
}

async function rest(url: string, serviceKey: string, path: string, method: string, body?: unknown) {
  const response = await fetch(url + '/rest/v1/' + path, {
    method,
    headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error('party_mapping_update_failed');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const serviceKey = envKey('SUPABASE_SECRET_KEYS') || envKey('SUPABASE_SERVICE_ROLE_KEY');
  const publishableKey = envKey('SUPABASE_PUBLISHABLE_KEYS') || envKey('SUPABASE_ANON_KEY');
  const authorization = request.headers.get('Authorization') || '';
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!url || !serviceKey || !publishableKey) return json({ error: 'function_not_configured' }, 500);

  let input: { action?: string; mobile?: string; password?: string };
  try { input = await request.json(); } catch (_) { return json({ error: 'invalid_request' }, 400); }
  const mobile = mobile10(input.mobile);
  const password = String(input.password || '');
  if (!mobile || password.length < 10 || password.length > 128 || !['set_password', 'login'].includes(String(input.action || ''))) {
    return json({ error: 'invalid_request' }, 400);
  }

  try {
    if (input.action === 'login') {
      const targets = await findTarget(url, serviceKey, mobile);
      if (targets.length !== 1) return json({ error: 'invalid_party_credentials' }, 401);
      const target = targets[0];
      const accountPath = 'aym_party_password_accounts?select=auth_user_id&organization_id=eq.' + encodeURIComponent(target.organization_id) + '&party_ref=eq.' + encodeURIComponent(target.party_ref);
      const accountResponse = await fetch(url + '/rest/v1/' + accountPath, { headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey }, cache: 'no-store' });
      const accounts = await accountResponse.json().catch(() => null);
      if (!accountResponse.ok || !Array.isArray(accounts) || accounts.length !== 1 || !accounts[0]?.auth_user_id) return json({ error: 'invalid_party_credentials' }, 401);
      const authResponse = await fetch(url + '/auth/v1/token?grant_type=password', {
        method: 'POST', headers: { apikey: publishableKey, Authorization: 'Bearer ' + publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: await partyAlias(target), password }), cache: 'no-store',
      });
      const auth = await authResponse.json().catch(() => null);
      if (!authResponse.ok || !auth?.access_token || !auth?.refresh_token || auth?.user?.id !== accounts[0].auth_user_id || auth?.user?.app_metadata?.aym_party_login !== true) return json({ error: 'invalid_party_credentials' }, 401);
      return json({ session: auth, user: auth.user });
    }
    if (!accessToken) return json({ error: 'email_verification_required' }, 401);
    const userResponse = await fetch(url + '/auth/v1/user', {
      headers: { apikey: publishableKey, Authorization: 'Bearer ' + accessToken }, cache: 'no-store',
    });
    const verifiedUser = await userResponse.json().catch(() => null);
    const verifiedEmail = String(verifiedUser?.email || '').trim().toLowerCase();
    if (!userResponse.ok || !verifiedUser?.id || !verifiedUser?.email_confirmed_at || !verifiedEmail) {
      return json({ error: 'email_verification_required' }, 401);
    }

    const targets = await findTarget(url, serviceKey, mobile, verifiedEmail);
    if (targets.length !== 1) return json({ error: targets.length > 1 ? 'party_mobile_ambiguous' : 'party_email_mobile_mismatch' }, 409);
    const target = targets[0];
    const accountPath = 'aym_party_password_accounts?select=auth_user_id,phone&organization_id=eq.' + encodeURIComponent(target.organization_id) + '&party_ref=eq.' + encodeURIComponent(target.party_ref);
    const accountResponse = await fetch(url + '/rest/v1/' + accountPath, {
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey }, cache: 'no-store',
    });
    if (!accountResponse.ok) throw new Error('party_mapping_lookup_failed');
    const accounts = await accountResponse.json();
    if (!Array.isArray(accounts) || accounts.length > 1) throw new Error('party_mapping_lookup_failed');

    let partyAuthUserId = accounts[0]?.auth_user_id || '';
    let created = false;
    const email = await partyAlias(target);
    if (partyAuthUserId) {
      await authAdmin(url, serviceKey, 'PUT', '/' + encodeURIComponent(partyAuthUserId), {
        email, email_confirm: true, password,
        app_metadata: { aym_party_login: true },
      });
    } else {
      const createdUser = await authAdmin(url, serviceKey, 'POST', '', {
        email, password, email_confirm: true,
        user_metadata: { account_type: 'party' },
      });
      partyAuthUserId = String(createdUser?.id || createdUser?.user?.id || '');
      if (!partyAuthUserId) throw new Error('party_auth_create_failed');
      created = true;
      await authAdmin(url, serviceKey, 'PUT', '/' + encodeURIComponent(partyAuthUserId), {
        email, email_confirm: true,
        app_metadata: { aym_party_login: true },
      });
    }

    try {
      await rest(url, serviceKey, 'aym_party_auth_links', 'POST', {
        organization_id: target.organization_id, auth_user_id: partyAuthUserId, party_ref: target.party_ref,
      });
      await rest(url, serviceKey, 'aym_org_members', 'POST', {
        organization_id: target.organization_id, auth_user_id: partyAuthUserId,
        role: 'party', party_ref: target.party_ref, is_active: true,
      });
      await rest(url, serviceKey, 'aym_party_password_accounts', 'POST', {
        organization_id: target.organization_id, party_ref: target.party_ref,
        auth_user_id: partyAuthUserId, phone: target.mobile, updated_at: new Date().toISOString(),
      });
    } catch (error) {
      if (created) {
        try { await rest(url, serviceKey, 'aym_org_members?organization_id=eq.' + encodeURIComponent(target.organization_id) + '&auth_user_id=eq.' + encodeURIComponent(partyAuthUserId), 'DELETE'); } catch (_) {}
        try { await rest(url, serviceKey, 'aym_party_auth_links?organization_id=eq.' + encodeURIComponent(target.organization_id) + '&auth_user_id=eq.' + encodeURIComponent(partyAuthUserId) + '&party_ref=eq.' + encodeURIComponent(target.party_ref), 'DELETE'); } catch (_) {}
        try { await authAdmin(url, serviceKey, 'DELETE', '/' + encodeURIComponent(partyAuthUserId)); } catch (_) {}
      }
      throw error;
    }
    return json({ ok: true });
  } catch (_) {
    return json({ error: 'party_password_setup_failed' }, 400);
  }
});
