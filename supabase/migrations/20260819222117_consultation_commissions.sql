-- Comissões são geradas por consulta realizada, não por venda da Hotmart.
create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  consultant_id uuid not null references public.profiles(id) on delete restrict,
  consultation_date timestamptz not null default now(),
  value_amount numeric(12,2) not null check (value_amount >= 0),
  commission_percentage numeric(5,2) not null default 10 check (commission_percentage between 0 and 100),
  company_return_amount numeric(12,2) generated always as (round(value_amount * commission_percentage / 100, 2)) stored,
  status text not null default 'completed' check (status in ('scheduled', 'completed', 'cancelled')),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists consultations_client_idx on public.consultations (client_id, consultation_date desc);
create index if not exists consultations_consultant_idx on public.consultations (consultant_id, consultation_date desc);

alter table public.consultations enable row level security;
drop policy if exists consultations_admin_all on public.consultations;
create policy consultations_admin_all on public.consultations
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
drop policy if exists consultations_consultant_access on public.consultations;
create policy consultations_consultant_access on public.consultations
  for select to authenticated
  using (public.current_user_role() = 'consultant' and consultant_id = auth.uid());
drop policy if exists consultations_consultant_insert on public.consultations;
create policy consultations_consultant_insert on public.consultations
  for insert to authenticated
  with check (public.current_user_role() = 'consultant' and consultant_id = auth.uid() and created_by = auth.uid());

insert into public.commissions_config (product_name, commission_percentage, is_active, updated_at)
values ('Consulta Individual', 10, true, now())
on conflict (product_name) do update
set commission_percentage = 10, is_active = true, updated_at = excluded.updated_at;
