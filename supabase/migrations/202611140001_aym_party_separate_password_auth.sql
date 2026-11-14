-- Separate Party password accounts from Admin email Auth accounts.
-- A Party's email OTP session authorizes password setup; an internal Auth
-- identity is then used while the interface continues to use mobile numbers.
begin;

create table if not exists public.aym_party_auth_links (
  organization_id uuid not null references public.aym_organizations(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  party_ref text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, auth_user_id, party_ref)
);
create index if not exists aym_party_auth_links_user_idx
  on public.aym_party_auth_links(auth_user_id, organization_id);
alter table public.aym_party_auth_links enable row level security;
revoke all on public.aym_party_auth_links from public, anon, authenticated;
grant all on public.aym_party_auth_links to service_role;

create table if not exists public.aym_party_password_accounts (
  organization_id uuid not null references public.aym_organizations(id) on delete cascade,
  party_ref text not null,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  phone text not null unique,
  updated_at timestamptz not null default now(),
  primary key (organization_id, party_ref),
  check (phone ~ '^\+[1-9][0-9]{7,14}$')
);
alter table public.aym_party_password_accounts enable row level security;
revoke all on public.aym_party_password_accounts from public, anon, authenticated;
grant all on public.aym_party_password_accounts to service_role;
grant select, insert, update, delete on public.aym_org_members to service_role;

create or replace function public.aym_has_party_auth_link(p_organization_id uuid, p_party_ref text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.aym_party_auth_links l
    where l.organization_id = p_organization_id
      and l.party_ref = p_party_ref
      and l.auth_user_id = (select auth.uid())
  )
$$;
revoke all on function public.aym_has_party_auth_link(uuid,text) from public, anon;
grant execute on function public.aym_has_party_auth_link(uuid,text) to authenticated;

-- Email-authenticated Admin users use their confirmed Auth email. Separate
-- Separate Party password users resolve only the email on their linked Party row.
create or replace function public.aym_verified_email()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (
      select min(pp.email) from public.aym_party_password_accounts pa
      join public.aym_party_portal pp
        on pp.organization_id = pa.organization_id and pp.party_ref = pa.party_ref
      join auth.users u on u.id = pa.auth_user_id
      where pa.auth_user_id = (select auth.uid())
        and u.email_confirmed_at is not null
        and u.raw_app_meta_data->>'aym_party_login' = 'true'
        and u.deleted_at is null
        and (u.banned_until is null or u.banned_until < now())
    ),
    (
      select lower(btrim(u.email)) from auth.users u
      where u.id = (select auth.uid())
        and u.email is not null and u.email_confirmed_at is not null
        and u.deleted_at is null
        and (u.banned_until is null or u.banned_until < now())
    )
  )
$$;
revoke all on function public.aym_verified_email() from public, anon;
grant execute on function public.aym_verified_email() to authenticated;

drop policy if exists aym_party_own_projection on public.aym_party_portal;
create policy aym_party_own_projection on public.aym_party_portal
for select to authenticated using (
  lower(btrim(email)) = (select public.aym_verified_email())
  and (
    exists (
      select 1 from public.aym_org_members m
      where m.organization_id = aym_party_portal.organization_id
        and m.auth_user_id = (select auth.uid())
        and m.role = 'party'
        and m.party_ref = aym_party_portal.party_ref
        and m.is_active
    )
  )
);

commit;
