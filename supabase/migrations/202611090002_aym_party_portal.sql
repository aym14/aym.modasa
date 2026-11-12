-- Read-only, email-authorized Party projections. Never expose the Admin snapshot.
begin;
create table if not exists public.aym_party_portal (
  organization_id uuid not null references public.aym_organizations(id) on delete cascade,
  sync_key text not null,
  party_ref text not null,
  email text not null check (email = lower(btrim(email))),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (organization_id, sync_key, party_ref),
  foreign key (organization_id,sync_key) references public.aym_cloud_ledger_snapshots(organization_id,sync_key) on delete cascade
);
create index if not exists aym_party_portal_email_idx on public.aym_party_portal(email);
do $$ begin
 if not exists(select 1 from pg_constraint where conname='aym_party_snapshot_fkey' and conrelid='public.aym_party_portal'::regclass) then
  alter table public.aym_party_portal add constraint aym_party_snapshot_fkey foreign key(organization_id,sync_key) references public.aym_cloud_ledger_snapshots(organization_id,sync_key) on delete cascade;
 end if;
end $$;
alter table public.aym_party_portal enable row level security;
revoke all on public.aym_party_portal from public, anon, authenticated;
grant select on public.aym_party_portal to authenticated;

-- Read the current Auth record, not caller-supplied email, IDs or metadata.
create or replace function public.aym_verified_email()
returns text language sql stable security definer set search_path = '' as $$
  select lower(btrim(u.email)) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null
    and u.deleted_at is null and (u.banned_until is null or u.banned_until < now())
$$;
revoke all on function public.aym_verified_email() from public, anon;
grant execute on function public.aym_verified_email() to authenticated;
drop policy if exists aym_party_own_projection on public.aym_party_portal;
create policy aym_party_own_projection on public.aym_party_portal
for select to authenticated using (
  email = (select public.aym_verified_email())
  and exists (
    select 1 from public.aym_org_members m
    where m.organization_id = aym_party_portal.organization_id
      and m.auth_user_id = (select auth.uid())
      and m.role = 'party'
      and m.party_ref = aym_party_portal.party_ref
      and m.is_active
  )
);

-- Strict field allowlists prevent future snapshot fields leaking automatically.
create or replace function public.aym_pick_fields(record jsonb, fields text[])
returns jsonb language sql immutable set search_path = '' as $$
 select coalesce(jsonb_object_agg(key,value), '{}'::jsonb)
 from jsonb_each(case when jsonb_typeof(record)='object' then record else '{}'::jsonb end)
 where key=any(fields)
$$;
revoke all on function public.aym_pick_fields(jsonb,text[]) from public, anon, authenticated;

create or replace function public.aym_rebuild_party_portal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p jsonb; pid text; mail text; own_entries jsonb; own_loans jsonb; own_modules jsonb; cats jsonb; mods jsonb;
begin
  delete from public.aym_party_portal where organization_id=NEW.organization_id and sync_key=NEW.sync_key;
  for p in select value from jsonb_array_elements(coalesce(NEW.data->'parties','[]'::jsonb)) loop
    pid := p->>'id'; mail := lower(btrim(coalesce(p->>'email','')));
    if nullif(pid,'') is null or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then continue; end if;
    select coalesce(jsonb_agg(public.aym_pick_fields(e, array['id','partyId','categoryId','date','type','amount','paymentMode','accountType','receiptNo','status'])), '[]'::jsonb)
      into own_entries from jsonb_array_elements(coalesce(NEW.data->'entries','[]'::jsonb)) e where e->>'partyId'=pid;
    select coalesce(jsonb_agg(public.aym_pick_fields(e, array['id','partyId','borrowerName','date','amount','loanAmount','status','planIdx','planIndex','createdAt','updatedAt','moduleRecordId','totalAmount','paidAmount','balance'])), '[]'::jsonb)
      into own_loans from jsonb_array_elements(coalesce(NEW.data->'loanForms','[]'::jsonb)) e where e->>'partyId'=pid;
    select coalesce(jsonb_agg(public.aym_pick_fields(e, array['id','partyId','moduleId','date','amount','loanAmount','status','paidAmount','balance'])), '[]'::jsonb)
      into own_modules from jsonb_array_elements(coalesce(NEW.data->'moduleRecords','[]'::jsonb)) e where e->>'partyId'=pid;
    select coalesce(jsonb_agg(public.aym_pick_fields(e, array['id','name','type'])), '[]'::jsonb)
      into cats from jsonb_array_elements(coalesce(NEW.data->'categories','[]'::jsonb)) e
      where exists (select 1 from jsonb_array_elements(own_entries) x where x->>'categoryId'=e->>'id');
    select coalesce(jsonb_agg(public.aym_pick_fields(e, array['id','name','kind','isLoanModule','distBehaviour'])), '[]'::jsonb)
      into mods from jsonb_array_elements(coalesce(NEW.data->'customModules','[]'::jsonb)) e
      where exists (select 1 from jsonb_array_elements(own_modules) x where x->>'moduleId'=e->>'id');
    insert into public.aym_party_portal(organization_id,sync_key,party_ref,email,data,updated_at)
    values(NEW.organization_id,NEW.sync_key,pid,mail,jsonb_build_object(
      'parties',jsonb_build_array(public.aym_pick_fields(p,array['id','name','email','mobile','fatherName','address','occupation'])),
      'entries',own_entries,'loanForms',own_loans,'moduleRecords',own_modules,'categories',cats,'customModules',mods
    ),NEW.updated_at);
  end loop;
  return NEW;
end;
$$;
revoke all on function public.aym_rebuild_party_portal() from public, anon, authenticated;
drop trigger if exists aym_party_portal_from_snapshot on public.aym_cloud_ledger_snapshots;
create trigger aym_party_portal_from_snapshot after insert or update of data on public.aym_cloud_ledger_snapshots
for each row execute function public.aym_rebuild_party_portal();

-- Invoker rights intentionally retain RLS. No caller-chosen Party/email arguments.
create or replace function public.aym_my_party_data()
returns setof public.aym_party_portal language sql stable security invoker set search_path = '' as $$
 select * from public.aym_party_portal order by organization_id,sync_key,party_ref
$$;
revoke all on function public.aym_my_party_data() from public, anon;
grant execute on function public.aym_my_party_data() to authenticated;
-- Backfill existing approved snapshots; trigger is transactional with the update.
update public.aym_cloud_ledger_snapshots set data=data;
commit;

