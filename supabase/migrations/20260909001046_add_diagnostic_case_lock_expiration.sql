alter table public.diagnostic_cases
  add column if not exists locked_at timestamp with time zone,
  add column if not exists lock_expires_at timestamp with time zone;
create index if not exists diagnostic_cases_lock_expires_idx
  on public.diagnostic_cases (lock_expires_at)
  where assigned_consultant_id is not null;
comment on column public.diagnostic_cases.locked_at is
  'Momento em que o caso foi reservado para revisão por uma consultora.';
comment on column public.diagnostic_cases.lock_expires_at is
  'Expiração automática do lock para evitar reservas presas quando navegador, rede ou sessão falham.';
update public.diagnostic_cases
set assigned_consultant_id = null,
    locked_at = null,
    lock_expires_at = null
where assigned_consultant_id is not null;
