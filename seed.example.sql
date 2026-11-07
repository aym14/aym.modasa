-- Template only. Replace every placeholder in the SQL Editor; do not commit
-- real account identifiers or private customer details to a public repository.

insert into public.aym_organizations (name)
values ('YOUR ORGANIZATION NAME')
returning id;

-- Use the organization UUID returned above and an existing Supabase Auth user UUID.
insert into public.aym_org_members
  (organization_id, auth_user_id, role, party_ref, is_active)
values
  ('YOUR_ORGANIZATION_UUID', 'YOUR_ADMIN_AUTH_USER_UUID', 'admin', null, true);

-- Party example: party_ref must be a stable internal party identifier that the
-- application will map to its ledger data. Do not use a phone number as a
-- permanent identifier. Create the Supabase Auth user through OTP first.
-- insert into public.aym_org_members
--   (organization_id, auth_user_id, role, party_ref, is_active)
-- values
--   ('YOUR_ORGANIZATION_UUID', 'YOUR_PARTY_AUTH_USER_UUID', 'party', 'YOUR_STABLE_PARTY_REF', true);
