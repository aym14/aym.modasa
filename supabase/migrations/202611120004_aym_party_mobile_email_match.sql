-- Verify the Party's supplied mobile and email pair before sending an email OTP.
begin;

create or replace function public.aym_party_mobile_email_matches(p_mobile text, p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    length(regexp_replace(coalesce(p_mobile,''), '[^0-9]', '', 'g')) >= 10
    and exists (
      select 1
      from public.aym_party_portal pp
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(pp.data->'parties')='array' then pp.data->'parties' else '[]'::jsonb end
      ) party
      where pp.email = lower(btrim(coalesce(p_email,'')))
        and right(regexp_replace(coalesce(party->>'mobile',''), '[^0-9]', '', 'g'), 10)
          = right(regexp_replace(coalesce(p_mobile,''), '[^0-9]', '', 'g'), 10)
    ), false
  );
$$;

revoke all on function public.aym_party_mobile_email_matches(text,text) from public;
grant execute on function public.aym_party_mobile_email_matches(text,text) to anon, authenticated;

commit;
