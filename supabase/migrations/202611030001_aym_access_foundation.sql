-- Organization membership foundation for Admin licensing and Party identity.
-- Ledger records are not stored or synced through this Supabase starter.

create table if not exists public.aym_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  created_at timestamptz not null default now()
);

create table if not exists public.aym_org_members (
  organization_id uuid not null references public.aym_organizations(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'party')),
  party_ref text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, auth_user_id),
  constraint aym_org_members_party_ref_check
    check ((role = 'admin' and party_ref is null) or (role = 'party' and nullif(btrim(party_ref), '') is not null))
);

create index if not exists aym_org_members_user_active_idx
  on public.aym_org_members (auth_user_id, is_active);

alter table public.aym_organizations enable row level security;
alter table public.aym_org_members enable row level security;

revoke all on public.aym_organizations from anon, authenticated;
revoke all on public.aym_org_members from anon, authenticated;
grant select on public.aym_organizations to authenticated;
grant select on public.aym_org_members to authenticated;

drop policy if exists aym_organizations_member_read on public.aym_organizations;
create policy aym_organizations_member_read
  on public.aym_organizations for select to authenticated
  using (
    exists (
      select 1 from public.aym_org_members m
      where m.organization_id = aym_organizations.id
        and m.auth_user_id = (select auth.uid())
        and m.is_active = true
    )
  );

drop policy if exists aym_org_members_self_read on public.aym_org_members;
create policy aym_org_members_self_read
  on public.aym_org_members for select to authenticated
  using (auth_user_id = (select auth.uid()) and is_active = true);

