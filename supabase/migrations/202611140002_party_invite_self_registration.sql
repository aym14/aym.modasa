-- Invite-based Party self-registration. A verified Party can add only their
-- own profile to the invited ledger; the snapshot trigger rebuilds the portal
-- projection and Admin Auto Sync pulls the new record without approval.
begin;

create table if not exists public.aym_party_registration_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aym_organizations(id) on delete cascade,
  sync_key text not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  use_count integer not null default 0 check (use_count between 0 and 1),
  created_at timestamptz not null default now(),
  foreign key (organization_id, sync_key)
    references public.aym_cloud_ledger_snapshots(organization_id, sync_key) on delete cascade
);
create index if not exists aym_party_registration_invites_scope_idx
  on public.aym_party_registration_invites(organization_id, sync_key, expires_at desc);
alter table public.aym_party_registration_invites enable row level security;
revoke all on public.aym_party_registration_invites from public, anon, authenticated;
grant select, insert, update, delete on public.aym_party_registration_invites to service_role;

create or replace function public.aym_create_party_registration_invite(
  p_organization_id uuid, p_sync_key text, p_token_hash text
) returns timestamptz language plpgsql security definer set search_path = '' as $$
declare expiry timestamptz;
begin
  if auth.uid() is null or not exists (
    select 1 from public.aym_org_members m
    where m.organization_id=p_organization_id and m.auth_user_id=(select auth.uid())
      and m.role='admin' and m.is_active
  ) then raise exception 'Active Admin sign-in required.' using errcode='42501'; end if;
  if length(btrim(coalesce(p_sync_key,''))) not between 1 and 80
     or coalesce(p_token_hash,'') !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid registration invite.' using errcode='22023';
  end if;
  if not exists(select 1 from public.aym_cloud_ledger_snapshots s
    where s.organization_id=p_organization_id and s.sync_key=p_sync_key) then
    raise exception 'Ledger not found.' using errcode='22023';
  end if;
  update public.aym_party_registration_invites
    set revoked_at=now()
    where organization_id=p_organization_id and sync_key=p_sync_key and revoked_at is null;
  expiry := now() + interval '365 days';
  insert into public.aym_party_registration_invites(
    organization_id,sync_key,token_hash,created_by,expires_at
  ) values(p_organization_id,p_sync_key,p_token_hash,(select auth.uid()),expiry);
  return expiry;
end;
$$;
revoke all on function public.aym_create_party_registration_invite(uuid,text,text) from public, anon;
grant execute on function public.aym_create_party_registration_invite(uuid,text,text) to authenticated;

create or replace function public.aym_register_party_by_invite(
  p_token_hash text, p_name text, p_mobile text, p_father_name text,
  p_address text, p_occupation text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  verified_email text;
  invite public.aym_party_registration_invites%rowtype;
  ledger jsonb;
  parties jsonb;
  party_ref text;
  digits text;
  party_data jsonb;
begin
  verified_email := public.aym_verified_email();
  if auth.uid() is null or verified_email is null then
    raise exception 'Verified email sign-in required.' using errcode='42501';
  end if;
  if coalesce(p_token_hash,'') !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid registration invite.' using errcode='22023';
  end if;
  if length(btrim(coalesce(p_name,''))) not between 3 and 160
     or length(btrim(coalesce(p_father_name,''))) not between 2 and 160
     or length(btrim(coalesce(p_address,''))) not between 2 and 300
     or length(btrim(coalesce(p_occupation,''))) > 120 then
    raise exception 'Party details are incomplete or invalid.' using errcode='22023';
  end if;
  digits := regexp_replace(coalesce(p_mobile,''), '\D', '', 'g');
  if length(digits)=12 and left(digits,2)='91' then digits := right(digits,10); end if;
  if length(digits)=11 and left(digits,1)='0' then digits := right(digits,10); end if;
  if length(digits) <> 10 then raise exception 'Enter a valid 10 digit mobile.' using errcode='22023'; end if;

  select * into invite from public.aym_party_registration_invites i
    where i.token_hash=p_token_hash and i.revoked_at is null and i.expires_at>now()
      and i.use_count<1 for update;
  if not found then raise exception 'Invite is invalid or expired.' using errcode='42501'; end if;
  -- Serialize registrations sharing either identity across different ledger invites.
  perform pg_advisory_xact_lock(hashtextextended('email:'||verified_email,0));
  perform pg_advisory_xact_lock(hashtextextended('mobile:'||digits,0));
  select s.data into ledger from public.aym_cloud_ledger_snapshots s
    where s.organization_id=invite.organization_id and s.sync_key=invite.sync_key for update;
  if not found then raise exception 'Ledger not found.' using errcode='22023'; end if;
  if exists (
    select 1 from public.aym_party_portal pp
    where lower(btrim(pp.email))=verified_email
       or exists (
         select 1 from jsonb_array_elements(coalesce(pp.data->'parties','[]'::jsonb)) p
         where right(regexp_replace(coalesce(p->>'mobile',''), '\D', '', 'g'),10)=digits
       )
  ) then raise exception 'Party mobile or email already exists in a ledger.' using errcode='23505'; end if;
  parties := case when jsonb_typeof(ledger->'parties')='array' then ledger->'parties' else '[]'::jsonb end;
  if exists (
    select 1 from jsonb_array_elements(parties) p
    where right(regexp_replace(coalesce(p->>'mobile',''), '\D', '', 'g'),10)=digits
       or lower(btrim(coalesce(p->>'email',''))) = verified_email
  ) then raise exception 'Party mobile or email already exists in this ledger.' using errcode='23505'; end if;

  party_ref := gen_random_uuid()::text;
  party_data := jsonb_build_object(
    'id',party_ref,'name',btrim(p_name),'mobile','+91'||digits,
    'email',verified_email,'fatherName',btrim(p_father_name),
    'guardianName',btrim(p_father_name),'address',btrim(p_address),
    'occupation',btrim(coalesce(p_occupation,'')),'registeredAt',now()
  );
  ledger := jsonb_set(ledger,'{parties}',parties||jsonb_build_array(party_data),true);
  update public.aym_cloud_ledger_snapshots s
    set data=ledger,updated_at=now(),updated_by=(select auth.uid())
    where s.organization_id=invite.organization_id and s.sync_key=invite.sync_key;
  update public.aym_party_registration_invites set use_count=use_count+1 where id=invite.id;
  return jsonb_build_object('ok',true,'party_ref',party_ref,'organization_id',invite.organization_id,'sync_key',invite.sync_key);
end;
$$;
revoke all on function public.aym_register_party_by_invite(text,text,text,text,text,text) from public, anon;
grant execute on function public.aym_register_party_by_invite(text,text,text,text,text,text) to authenticated;

commit;
