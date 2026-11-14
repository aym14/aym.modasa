const attempts = new Map<string, { count: number; resetAt: number }>();
/* Best-effort per-instance throttle (Supabase Auth keeps its own global limits). */
function tooMany(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (attempts.size > 5000) { for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k); }
  const cur = attempts.get(key);
  if (!cur || cur.resetAt <= now) { attempts.set(key, { count: 1, resetAt: now + windowMs }); return false; }
  cur.count += 1;
  return cur.count > limit;
}
function clientIp(request: Request): string {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
}
/* Set AYM_ALLOWED_ORIGINS (comma separated, e.g. https://aym14.github.io) to lock CORS; unset keeps "*". */
function corsFor(request: Request): Record<string, string> {
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  const allowed = String(Deno.env.get('AYM_ALLOWED_ORIGINS') || '').split(',').map((v) => v.trim().replace(/\/+$/, '')).filter(Boolean);
  if (!allowed.length) return { ...base, 'Access-Control-Allow-Origin': '*' };
  const origin = String(request.headers.get('Origin') || '').replace(/\/+$/, '');
  return allowed.includes(origin) ? { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : { ...base, Vary: 'Origin' };
}

function envKey(name: string): string {
  const raw = Deno.env.get(name) || '';
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : String(parsed.default || '');
  } catch (_) { return raw; }
}

function lastTen(value: unknown): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type PartyLookup = { email: string | null; ambiguous: boolean };

async function findPartyEmail(url: string, serviceKey: string, mobile: string): Promise<PartyLookup> {
  const identities = new Map<string, Set<string>>();
  // Party emails may live on the Party object in the live ledger snapshot.
  // Keep the portal directory fallback for existing deployments that still use it.
  for (const table of ['aym_cloud_ledger_snapshots', 'aym_party_portal']) {
    for (let offset = 0; offset < 10000; offset += 500) {
      const select = table === 'aym_party_portal' ? 'organization_id,party_ref,email,parties:data->parties' : 'organization_id,parties:data->parties';
      const response = await fetch(url + '/rest/v1/' + table + '?select=' + select + '&limit=500', {
        headers: {
          apikey: serviceKey,
          Authorization: 'Bearer ' + serviceKey,
          Range: offset + '-' + (offset + 499),
          'Range-Unit': 'items',
        },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Party directory lookup failed.');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Party directory response was invalid.');
      for (const row of rows) {
        const parties = row && Array.isArray(row.parties) ? row.parties : [];
        for (const party of parties) {
          if (lastTen(party.mobile) !== mobile) continue;
          const email = String(party.email || party.partyEmail || party.emailAddress || row.email || '').trim().toLowerCase();
          if (!email) continue;
          const partyId = String(party.id || row.party_ref || '');
          const identity = String(row.organization_id || '') + ':' + partyId;
          if (!identities.has(identity)) identities.set(identity, new Set<string>());
          identities.get(identity)!.add(email);
        }
      }
      if (rows.length < 500) break;
    }
  }
  const emails = new Set<string>();
  let identityHasConflictingEmails = false;
  for (const values of identities.values()) {
    if (values.size !== 1) identityHasConflictingEmails = true;
    for (const value of values) emails.add(value);
  }
  return { email: identities.size === 1 && emails.size === 1 ? Array.from(emails)[0] : null, ambiguous: identities.size > 1 || emails.size > 1 || identityHasConflictingEmails };
}

async function handle(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const serviceKey = envKey('SUPABASE_SECRET_KEYS') || envKey('SUPABASE_SERVICE_ROLE_KEY');
  const publishableKey = envKey('SUPABASE_PUBLISHABLE_KEYS') || envKey('SUPABASE_ANON_KEY');
  if (!url || !serviceKey || !publishableKey) return json({ error: 'function_not_configured' }, 500);

  let input: { action?: string; mobile?: string; token?: string };
  try { input = await request.json(); } catch (_) { return json({ error: 'invalid_request' }, 400); }
  const mobile = lastTen(input.mobile);
  if (!mobile) return json({ error: 'invalid_request' }, 400);
  if (input.action !== 'send' && input.action !== 'verify') return json({ error: 'invalid_request' }, 400);

  const ip = clientIp(request);
  if (input.action === 'send' && (tooMany('otp-send:' + mobile, 5, 15 * 60_000) || tooMany('otp-send-ip:' + ip, 30, 15 * 60_000))) return json({ error: 'otp_rate_limited' }, 429);
  if (input.action === 'verify' && (tooMany('otp-verify:' + mobile, 10, 15 * 60_000) || tooMany('otp-verify-ip:' + ip, 60, 15 * 60_000))) return json({ error: 'otp_rate_limited' }, 429);

  try {
    const lookup = await findPartyEmail(url, serviceKey, mobile);
    const email = lookup.email;
    if (input.action === 'send') {
      // Do not report success unless a unique registered email was found and Auth accepted the OTP.
      // Same reply whether or not the number is registered: no phone-number enumeration.
      if (lookup.ambiguous || !email) return json({ ok: true });
      const response = await fetch(url + '/auth/v1/otp', {
        method: 'POST',
        headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, create_user: false }),
      });
      if (!response.ok) {
        return json({ error: response.status === 429 ? 'otp_rate_limited' : 'otp_unavailable' }, response.status === 429 ? 429 : 502);
      }
      return json({ ok: true });
    }

    const token = String(input.token || '').replace(/\D/g, '');
    if (lookup.ambiguous) return json({ error: 'party_mobile_ambiguous' }, 409);
    if (!email || token.length < 6 || token.length > 10) return json({ error: 'invalid_code' }, 400);
    const response = await fetch(url + '/auth/v1/verify', {
      method: 'POST',
      headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, type: 'email' }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result || !result.access_token || !result.refresh_token || !result.user || String(result.user.email || '').trim().toLowerCase() !== email) {
      return json({ error: 'invalid_code' }, 400);
    }
    return json({
      session: {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: Number(result.expires_in || 3600),
        token_type: result.token_type || 'bearer',
      },
      user: result.user,
    });
  } catch (_) {
    // Avoid logging or returning Party identifiers, email addresses, or auth tokens.
    return json({ error: input.action === 'send' ? 'otp_unavailable' : 'invalid_code' }, 400);
  }
}

Deno.serve(async (request) => {
  const cors = corsFor(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  let response: Response;
  try { response = await handle(request); } catch (_) { response = json({ error: 'internal_error' }, 500); }
  for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
  return response;
});
