alter table public.profiles
  add column if not exists archived_at timestamptz;

create index if not exists profiles_active_operator_idx
  on public.profiles (status)
  where archived_at is null;
