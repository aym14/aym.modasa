-- One-time/idempotent Admin membership setup for AYM Online Sync.
-- Run after migrations 202611030001, 202611070001, and 202611090001.
-- This does not write ledger records or expose the service-role key.

do $$
declare
  admin_email constant text := 'modasa.aym@gmail.com';
  org_name constant text := 'Ansar Yuva Mandal - Modasa';
  admin_auth_id uuid;
  org_id uuid;
  org_count integer;
begin
  if to_regclass('public.aym_organizations') is null
     or to_regclass('public.aym_org_members') is null
     or to_regclass('public.aym_cloud_ledger_snapshots') is null then
    raise exception 'Required AYM migrations are missing. Apply migrations 202611030001, 202611070001, and 202611090001 first.';
  end if;

  select id into admin_auth_id
    from auth.users
   where lower(email) = lower(admin_email)
     and email_confirmed_at is not null
     and deleted_at is null;

  if admin_auth_id is null then
    raise exception 'No confirmed Auth user found for %. Create/confirm this user in Supabase Auth first.', admin_email;
  end if;

  select count(*)::integer into org_count
    from public.aym_organizations
   where name = org_name;

  if org_count > 1 then
    raise exception 'Multiple organizations named % exist. Resolve duplicates before setup.', org_name;
  elsif org_count = 1 then
    select id into org_id
      from public.aym_organizations
     where name = org_name
     limit 1;
  else
    insert into public.aym_organizations (name)
    values (org_name)
    returning id into org_id;
  end if;

  insert into public.aym_org_members
    (organization_id, auth_user_id, role, party_ref, is_active)
  values
    (org_id, admin_auth_id, 'admin', null, true)
  on conflict (organization_id, auth_user_id)
  do update set
    role = 'admin',
    party_ref = null,
    is_active = true;

  raise notice 'Cloud Sync Admin membership ready. Organization UUID: %', org_id;
end
$$;

-- Verification: this should return exactly one active admin row.
select o.id as organization_id,
       o.name as organization_name,
       u.id as auth_user_id,
       u.email as admin_email,
       m.role,
       m.is_active
  from public.aym_organizations o
  join public.aym_org_members m on m.organization_id = o.id
  join auth.users u on u.id = m.auth_user_id
 where o.name = 'Ansar Yuva Mandal - Modasa'
   and lower(u.email) = lower('modasa.aym@gmail.com')
   and m.role = 'admin'
   and m.is_active = true;

-- Snapshot status for the configured default sync name.
select organization_id, sync_key, updated_at
  from public.aym_cloud_ledger_snapshots
 where organization_id = (
   select id from public.aym_organizations
    where name = 'Ansar Yuva Mandal - Modasa'
    limit 1
 )
   and sync_key = 'main';
