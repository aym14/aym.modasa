-- Party-submitted requests with organization, verified identity and Admin-only review.
begin;

create table if not exists public.aym_party_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aym_organizations(id) on delete cascade,
  sync_key text not null,
  party_ref text not null,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  party_name text not null check (length(btrim(party_name)) between 1 and 160),
  party_email text not null check (party_email = lower(btrim(party_email))),
  subject text not null check (length(btrim(subject)) between 2 and 120),
  message text not null check (length(btrim(message)) between 2 and 4000),
  status text not null default 'new' check (status in ('new','reviewing','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aym_party_requests_admin_list_idx
  on public.aym_party_requests (organization_id, created_at desc);

alter table public.aym_party_requests enable row level security;
revoke all on public.aym_party_requests from public, anon, authenticated;
grant select, update on public.aym_party_requests to authenticated;

drop policy if exists aym_party_requests_admin_read on public.aym_party_requests;
create policy aym_party_requests_admin_read on public.aym_party_requests
  for select to authenticated using (
    exists (select 1 from public.aym_org_members m
      where m.organization_id = aym_party_requests.organization_id
        and m.auth_user_id = (select auth.uid()) and m.role = 'admin' and m.is_active)
  );

drop policy if exists aym_party_requests_admin_update on public.aym_party_requests;
create policy aym_party_requests_admin_update on public.aym_party_requests
  for update to authenticated using (
    exists (select 1 from public.aym_org_members m
      where m.organization_id = aym_party_requests.organization_id
        and m.auth_user_id = (select auth.uid()) and m.role = 'admin' and m.is_active)
  ) with check (
    exists (select 1 from public.aym_org_members m
      where m.organization_id = aym_party_requests.organization_id
        and m.auth_user_id = (select auth.uid()) and m.role = 'admin' and m.is_active)
  );

create or replace function public.aym_submit_party_request(
  p_organization_id uuid, p_sync_key text, p_party_ref text,
  p_subject text, p_message text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare verified_email text; party_name text; request_id uuid;
begin
  verified_email := public.aym_verified_email();
  if verified_email is null then raise exception 'Verified email sign-in required.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_subject,''))) not between 2 and 120 then raise exception 'Subject must be 2 to 120 characters.' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_message,''))) not between 2 and 4000 then raise exception 'Message must be 2 to 4000 characters.' using errcode = '22023'; end if;
  select pp.data->'parties'->0->>'name' into party_name
    from public.aym_party_portal pp
    where pp.organization_id=p_organization_id and pp.sync_key=p_sync_key
      and pp.party_ref=p_party_ref and pp.email=verified_email;
  if party_name is null or not exists (
    select 1 from public.aym_org_members m
    where m.organization_id=p_organization_id and m.auth_user_id=(select auth.uid())
      and m.role='party' and m.party_ref=p_party_ref and m.is_active
  ) then raise exception 'Party account is not linked to this ledger.' using errcode = '42501'; end if;
  insert into public.aym_party_requests(organization_id,sync_key,party_ref,submitted_by,party_name,party_email,subject,message)
  values(p_organization_id,p_sync_key,p_party_ref,(select auth.uid()),party_name,verified_email,btrim(p_subject),btrim(p_message))
  returning id into request_id;
  return request_id;
end;
$$;

revoke all on function public.aym_submit_party_request(uuid,text,text,text,text) from public, anon;
grant execute on function public.aym_submit_party_request(uuid,text,text,text,text) to authenticated;

create or replace function public.aym_touch_party_request()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists aym_party_requests_touch on public.aym_party_requests;
create trigger aym_party_requests_touch before update on public.aym_party_requests
for each row execute function public.aym_touch_party_request();

commit;
