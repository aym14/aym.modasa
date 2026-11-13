-- Requests are authorized by the verified-email Party projection, matching portal sign-in.
begin;

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
  if party_name is null then raise exception 'Party account is not linked to this ledger.' using errcode = '42501'; end if;
  insert into public.aym_party_requests(organization_id,sync_key,party_ref,submitted_by,party_name,party_email,subject,message)
  values(p_organization_id,p_sync_key,p_party_ref,(select auth.uid()),party_name,verified_email,btrim(p_subject),btrim(p_message))
  returning id into request_id;
  return request_id;
end;
$$;

revoke all on function public.aym_submit_party_request(uuid,text,text,text,text) from public, anon;
grant execute on function public.aym_submit_party_request(uuid,text,text,text,text) to authenticated;

commit;
