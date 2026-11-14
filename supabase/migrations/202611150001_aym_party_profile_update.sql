-- Allow an authenticated Party to persist only their own safe profile fields.
begin;

create or replace function public.aym_update_my_party_profile(
  p_organization_id uuid,
  p_sync_key text,
  p_party_ref text,
  p_name text,
  p_father_name text,
  p_address text,
  p_occupation text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  verified_email text;
  snapshot_data jsonb;
  updated_parties jsonb;
  found_party boolean := false;
begin
  verified_email := public.aym_verified_email();
  if auth.uid() is null or verified_email is null then
    raise exception 'Verified email sign-in required.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_name,''))) not between 3 and 160
     or length(btrim(coalesce(p_father_name,''))) > 160
     or length(btrim(coalesce(p_address,''))) > 300
     or length(btrim(coalesce(p_occupation,''))) > 120 then
    raise exception 'Profile details are invalid.' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.aym_party_portal pp
    join public.aym_org_members m on m.organization_id=pp.organization_id
      and m.auth_user_id=(select auth.uid()) and m.role='party'
      and m.party_ref=pp.party_ref and m.is_active
    where pp.organization_id=p_organization_id and pp.sync_key=p_sync_key
      and pp.party_ref=p_party_ref and pp.email=verified_email
  ) then
    raise exception 'Party account is not linked to this ledger.' using errcode='42501';
  end if;

  select s.data into snapshot_data
  from public.aym_cloud_ledger_snapshots s
  where s.organization_id=p_organization_id and s.sync_key=p_sync_key
  for update;
  if not found then raise exception 'Ledger not found.' using errcode='22023'; end if;

  select coalesce(jsonb_agg(case when item.value->>'id'=p_party_ref then
      item.value || jsonb_build_object(
        'name',btrim(p_name),
        'fatherName',btrim(coalesce(p_father_name,'')),
        'guardianName',btrim(coalesce(p_father_name,'')),
        'address',btrim(coalesce(p_address,'')),
        'occupation',btrim(coalesce(p_occupation,''))
      ) else item.value end order by item.ordinality),'[]'::jsonb)
    into updated_parties
  from jsonb_array_elements(coalesce(snapshot_data->'parties','[]'::jsonb))
    with ordinality as item(value,ordinality);
  select exists(select 1 from jsonb_array_elements(coalesce(snapshot_data->'parties','[]'::jsonb)) p where p->>'id'=p_party_ref)
    into found_party;
  if not found_party then raise exception 'Party profile not found.' using errcode='22023'; end if;

  update public.aym_cloud_ledger_snapshots s
  set data=jsonb_set(snapshot_data,'{parties}',updated_parties,true),
      updated_at=now(),updated_by=(select auth.uid())
  where s.organization_id=p_organization_id and s.sync_key=p_sync_key;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.aym_update_my_party_profile(uuid,text,text,text,text,text,text) from public, anon;
grant execute on function public.aym_update_my_party_profile(uuid,text,text,text,text,text,text) to authenticated;

-- A guarantor replacement request must point to a loan belonging to this Party.
alter function public.aym_submit_party_form(uuid,text,text,text,jsonb) rename to aym_submit_party_form_before_loan_check;
revoke all on function public.aym_submit_party_form_before_loan_check(uuid,text,text,text,jsonb) from public, anon, authenticated;
create or replace function public.aym_submit_party_form(
  p_organization_id uuid,p_sync_key text,p_party_ref text,p_form_type text,p_payload jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare snapshot_data jsonb; loan_ref text;
begin
  if p_form_type='guarantor_change' then
    loan_ref:=btrim(coalesce(p_payload->>'loan_reference',''));
    select s.data into snapshot_data from public.aym_cloud_ledger_snapshots s
      where s.organization_id=p_organization_id and s.sync_key=p_sync_key;
    if not found or not exists (
      select 1 from jsonb_array_elements(coalesce(snapshot_data->'loanForms','[]'::jsonb)) l
      where l->>'partyId'=p_party_ref and (
        lower(btrim(coalesce(l->>'id','')))=lower(loan_ref)
        or lower(btrim(coalesce(l->>'comNo','')))=lower(loan_ref)
        or lower(btrim(coalesce(l->>'applicationNumber','')))=lower(loan_ref)
        or lower(btrim(coalesce(l->>'borrowerName','')))=lower(loan_ref)
      )
    ) then raise exception 'Select a loan belonging to your Party account.' using errcode='42501'; end if;
  end if;
  return public.aym_submit_party_form_before_loan_check(p_organization_id,p_sync_key,p_party_ref,p_form_type,p_payload);
end;
$$;
revoke all on function public.aym_submit_party_form(uuid,text,text,text,jsonb) from public, anon;
grant execute on function public.aym_submit_party_form(uuid,text,text,text,jsonb) to authenticated;

commit;
