-- Run in SQL Editor as project owner. All sample data is rolled back.
begin;
do $$
declare org uuid; subject uuid; subject_email text;
begin
 select id,lower(email) into subject,subject_email from auth.users where email_confirmed_at is not null order by created_at desc limit 1;
 if subject is null then raise exception 'The test email must be verified first'; end if;
 insert into public.aym_organizations(name) values ('AYM isolation test - rollback only') returning id into org;
 perform set_config('aym.test_org',org::text,true);
 perform set_config('request.jwt.claim.sub',subject::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated')::text,true);
 insert into public.aym_cloud_ledger_snapshots(organization_id,sync_key,data) values(org,'isolation-test',
 replace('{"parties":[{"id":"own-party","name":"Own sample","email":"__AYM_VERIFIED_TEST_EMAIL__","password":"must-not-leak"},{"id":"other-party","name":"Other sample","email":"other@example.invalid"}],"entries":[{"id":"own-entry","partyId":"own-party","amount":100,"privateNote":"must-not-leak"},{"id":"other-entry","partyId":"other-party","amount":900}],"users":[{"password":"must-not-leak"}]}'::text,'__AYM_VERIFIED_TEST_EMAIL__',subject_email)::jsonb);
end $$;
set local role authenticated;
do $$
declare result jsonb;
begin
 select data into result from public.aym_my_party_data() where organization_id=current_setting('aym.test_org')::uuid;
 if result is null or jsonb_array_length(result->'parties')<>1 or jsonb_array_length(result->'entries')<>1 then raise exception 'Own Party scope failed'; end if;
 if result->'entries'->0->>'id'<>'own-entry' then raise exception 'Wrong entry returned'; end if;
 if result::text like '%must-not-leak%' or result::text like '%other-party%' then raise exception 'Private data leaked'; end if;
 if exists(select 1 from public.aym_party_portal where organization_id=current_setting('aym.test_org')::uuid and party_ref='other-party') then raise exception 'Cross-Party query succeeded'; end if;
 if exists(select 1 from public.aym_cloud_ledger_snapshots where organization_id=current_setting('aym.test_org')::uuid) then raise exception 'Full Admin snapshot leaked'; end if;
 if has_table_privilege(current_user,'public.aym_party_portal','INSERT,UPDATE,DELETE') then raise exception 'Party has write privileges'; end if;
 if has_function_privilege('anon','public.aym_my_party_data()','EXECUTE') then raise exception 'Anonymous RPC allowed'; end if;
end $$;
reset role;
-- Removing a Party email from an approved snapshot revokes the projection.
update public.aym_cloud_ledger_snapshots set data=jsonb_set(data,'{parties,0,email}','"revoked@example.invalid"')
where organization_id=current_setting('aym.test_org')::uuid;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.aym_my_party_data() where organization_id=current_setting('aym.test_org')::uuid) then raise exception 'Revoked Party still has access'; end if;
end $$;
reset role;
rollback;
select 'PASS: own records, cross-Party denial, secret filtering, no Admin snapshot, no writes, no anonymous access, revocation; fixtures rolled back' as result;

