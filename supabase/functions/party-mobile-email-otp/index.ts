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

function lastTen(value: unknown): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function findPartyEmail(url: string, serviceKey: string, mobile: string): Promise<string | null> {
  const emails = new Set<string>();
  for (let offset = 0; offset < 10000; offset += 500) {
    const response = await fetch(url + '/rest/v1/aym_party_portal?select=email,data&limit=500', {
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
      const parties = row && row.data && Array.isArray(row.data.parties) ? row.data.parties : [];
      if (parties.some((party: Record<string, unknown>) => lastTen(party.mobile) === mobile)) {
        const email = String(row.email || '').trim().toLowerCase();
        if (email) emails.add(email);
      }
    }
    if (rows.length < 500) break;
  }
  return emails.size === 1 ? Array.from(emails)[0] : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
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

  try {
    const email = await findPartyEmail(url, serviceKey, mobile);
    if (input.action === 'send') {
      // Keep the response identical for known and unknown numbers; never reveal Party email.
      if (email) {
        const delivery = await fetch(url + '/auth/v1/otp', {
          method: 'POST',
          headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, create_user: true }),
        });
        // Auth failures used to be silently reported as success. Log only the
        // provider status (never the phone, email, response body, or OTP) so
        // delivery failures can be diagnosed without exposing Party accounts.
        if (!delivery.ok) console.error('Party email OTP provider rejected request', delivery.status);
      }
      return json({ ok: true });
    }

    const token = String(input.token || '').replace(/\D/g, '');
    if (!email || token.length !== 6) return json({ error: 'invalid_code' }, 400);
    const response = await fetch(url + '/auth/v1/verify', {
      method: 'POST',
      headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, type: 'email' }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result || !result.access_token || !result.refresh_token || !result.user) {
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
    if (input.action === 'send') {
      console.error('Party email OTP delivery request failed');
      // Preserve the same response for unknown mobile numbers and transient
      // lookup/provider failures so this endpoint cannot be used to enumerate Parties.
      return json({ ok: true });
    }
    return json({ error: 'invalid_code' }, 400);
  }
});

