-- Remove the temporary public mobile/email matching RPC.
-- Party email resolution now stays inside the server-side Edge Function.
drop function if exists public.aym_party_mobile_email_matches(text, text);

