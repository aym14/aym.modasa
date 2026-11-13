-- Verified Party online loan and guarantor-change applications with Admin-only review.
begin;

create table if not exists public.aym_party_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.aym_organizations(id) on delete cascade,
  sync_key text not null,
  party_ref text not null,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  party_name text not null check (length(btrim(party_name)) between 1 and 160),
  party_email text not null check (party_email = lower(btrim(party_email))),
  form_type text not null check (form_type in ('loan_application','guarantor_change')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending','reviewing','approved','rejected')),
  admin_note text not null default '' check (length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aym_party_forms_admin_list_idx on public.aym_party_forms (organization_id, created_at desc);
alter table public.aym_party_forms enable row level security;
revoke all on public.aym_party_forms from public, anon, authenticated;
grant select, update on public.aym_party_forms to authenticated;

drop policy if exists aym_party_forms_admin_read on public.aym_party_forms;
create policy aym_party_forms_admin_read on public.aym_party_forms for select to authenticated using (
  exists (select 1 from public.aym_org_members m where m.organization_id=aym_party_forms.organization_id
    and m.auth_user_id=(select auth.uid()) and m.role='admin' and m.is_active)
);
drop policy if exists aym_party_forms_admin_update on public.aym_party_forms;
create policy aym_party_forms_admin_update on public.aym_party_forms for update to authenticated using (
  exists (select 1 from public.aym_org_members m where m.organization_id=aym_party_forms.organization_id
    and m.auth_user_id=(select auth.uid()) and m.role='admin' and m.is_active)
) with check (
  exists (select 1 from public.aym_org_members m where m.organization_id=aym_party_forms.organization_id
    and m.auth_user_id=(select auth.uid()) and m.role='admin' and m.is_active)
);

create or replace function public.aym_submit_party_form(
  p_organization_id uuid, p_sync_key text, p_party_ref text, p_form_type text, p_payload jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare verified_email text; party_name text; form_id uuid; amount numeric;
begin
  verified_email := public.aym_verified_email();
  if verified_email is null then raise exception 'Verified email sign-in required.' using errcode='42501'; end if;
  if p_form_type not in ('loan_application','guarantor_change') or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid form.' using errcode='22023';
  end if;
  select pp.data->'parties'->0->>'name' into party_name from public.aym_party_portal pp
    where pp.organization_id=p_organization_id and pp.sync_key=p_sync_key and pp.party_ref=p_party_ref and pp.email=verified_email;
  if party_name is null then raise exception 'Party account is not linked to this ledger.' using errcode='42501'; end if;
  if p_form_type='loan_application' then
    begin amount := (p_payload->>'amount')::numeric; exception when others then amount := null; end;
    if amount is null or amount <= 0 or amount > 100000000
      or length(btrim(coalesce(p_payload->>'purpose',''))) not between 2 and 500
      or length(btrim(coalesce(p_payload->>'mobile',''))) not between 7 and 20
      or jsonb_typeof(p_payload->'guarantors') is distinct from 'array' then
      raise exception 'Loan application has missing or invalid details.' using errcode='22023';
    end if;
  else
    if length(btrim(coalesce(p_payload->>'loan_reference',''))) not between 1 and 160
      or length(btrim(coalesce(p_payload->>'old_guarantor',''))) not between 2 and 160
      or length(btrim(coalesce(p_payload->>'new_guarantor',''))) not between 2 and 160
      or lower(btrim(p_payload->>'old_guarantor'))=lower(btrim(p_payload->>'new_guarantor'))
      or length(btrim(coalesce(p_payload->>'reason',''))) not between 2 and 1000 then
      raise exception 'Guarantor change form has missing or invalid details.' using errcode='22023';
    end if;
  end if;
  if octet_length(p_payload::text)>12000 then raise exception 'Form is too large.' using errcode='22023'; end if;
  insert into public.aym_party_forms(organization_id,sync_key,party_ref,submitted_by,party_name,party_email,form_type,payload)
    values(p_organization_id,p_sync_key,p_party_ref,(select auth.uid()),party_name,verified_email,p_form_type,p_payload)
    returning id into form_id;
  return form_id;
end;
$$;
revoke all on function public.aym_submit_party_form(uuid,text,text,text,jsonb) from public, anon;
grant execute on function public.aym_submit_party_form(uuid,text,text,text,jsonb) to authenticated;

create or replace function public.aym_touch_party_form()
returns trigger language plpgsql set search_path='' as $$ begin new.updated_at:=now(); return new; end; $$;
drop trigger if exists aym_party_forms_touch on public.aym_party_forms;
create trigger aym_party_forms_touch before update on public.aym_party_forms for each row execute function public.aym_touch_party_form();

commit;
