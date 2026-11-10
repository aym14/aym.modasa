-- Private, organization-scoped ledger snapshots for trusted Admin devices.
-- Apply after 202611030001_aym_access_foundation.sql.

create table if not exists public.aym_cloud_ledger_snapshots (
  organization_id uuid not null references public.aym_organizations(id) on delete cascade,
  sync_key text not null default 'main' check (length(btrim(sync_key)) between 1 and 80),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (organization_id, sync_key)
);

alter table public.aym_cloud_ledger_snapshots enable row level security;
revoke all on public.aym_cloud_ledger_snapshots from anon, authenticated;
grant select, insert, update on public.aym_cloud_ledger_snapshots to authenticated;

drop policy if exists aym_cloud_ledger_admin_read on public.aym_cloud_ledger_snapshots;
create policy aym_cloud_ledger_admin_read
  on public.aym_cloud_ledger_snapshots for select to authenticated
  using (
    exists (
      select 1 from public.aym_org_members m
      where m.organization_id = aym_cloud_ledger_snapshots.organization_id
        and m.auth_user_id = (select auth.uid())
        and m.role = 'admin'
        and m.is_active = true
    )
  );

drop policy if exists aym_cloud_ledger_admin_insert on public.aym_cloud_ledger_snapshots;
create policy aym_cloud_ledger_admin_insert
  on public.aym_cloud_ledger_snapshots for insert to authenticated
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1 from public.aym_org_members m
      where m.organization_id = aym_cloud_ledger_snapshots.organization_id
        and m.auth_user_id = (select auth.uid())
        and m.role = 'admin'
        and m.is_active = true
    )
  );

drop policy if exists aym_cloud_ledger_admin_update on public.aym_cloud_ledger_snapshots;
create policy aym_cloud_ledger_admin_update
  on public.aym_cloud_ledger_snapshots for update to authenticated
  using (
    exists (
      select 1 from public.aym_org_members m
      where m.organization_id = aym_cloud_ledger_snapshots.organization_id
        and m.auth_user_id = (select auth.uid())
        and m.role = 'admin'
        and m.is_active = true
    )
  )
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1 from public.aym_org_members m
      where m.organization_id = aym_cloud_ledger_snapshots.organization_id
        and m.auth_user_id = (select auth.uid())
        and m.role = 'admin'
        and m.is_active = true
    )
  );

