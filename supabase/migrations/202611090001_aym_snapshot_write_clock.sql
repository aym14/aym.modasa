-- The server owns the compare-and-swap token, independent of device clocks.
create or replace function public.aym_snapshot_write_clock()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    NEW.updated_at := greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  else
    NEW.updated_at := clock_timestamp();
  end if;
  NEW.updated_by := auth.uid();
  return NEW;
end;
$$;

drop trigger if exists aym_snapshot_write_clock on public.aym_cloud_ledger_snapshots;
create trigger aym_snapshot_write_clock
before insert or update on public.aym_cloud_ledger_snapshots
for each row execute function public.aym_snapshot_write_clock();

