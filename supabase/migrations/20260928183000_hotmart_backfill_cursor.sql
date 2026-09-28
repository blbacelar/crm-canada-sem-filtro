-- The sales API defaults to recent sales when no date window is supplied.
-- Persist a cursor so each daily run can safely scan older 30-day windows.
create table if not exists public.hotmart_sync_state (
  key text primary key,
  backfill_before timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.hotmart_sync_state enable row level security;
revoke all on public.hotmart_sync_state from public, anon, authenticated;
grant select, insert, update on public.hotmart_sync_state to service_role;

insert into public.hotmart_sync_state (key, backfill_before)
values ('sales', now() - interval '90 days')
on conflict (key) do nothing;

notify pgrst, 'reload schema';
