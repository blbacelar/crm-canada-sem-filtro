-- Cadastro central compartilhado pelo CRM, Hotmart e App de Diagnóstico.
-- Antes de aplicar em um ambiente com dados, resolva duplicidades de e-mail
-- normalizado: o índice único abaixo deve falhar em vez de apagar clientes.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  email text not null check (email = lower(trim(email))),
  source text not null default 'manual',
  phone text,
  document text,
  country text,
  zip_code text,
  city text,
  state text,
  address text,
  district text,
  number text,
  complement text,
  status_journey text not null default 'lead',
  is_overdue boolean not null default false,
  assigned_consultant_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients add column if not exists phone text;
alter table public.clients add column if not exists source text not null default 'manual';
alter table public.clients add column if not exists document text;
alter table public.clients add column if not exists country text;
alter table public.clients add column if not exists zip_code text;
alter table public.clients add column if not exists city text;
alter table public.clients add column if not exists state text;
alter table public.clients add column if not exists address text;
alter table public.clients add column if not exists district text;
alter table public.clients add column if not exists number text;
alter table public.clients add column if not exists complement text;
alter table public.clients add column if not exists status_journey text not null default 'lead';
alter table public.clients add column if not exists is_overdue boolean not null default false;
alter table public.clients add column if not exists assigned_consultant_id uuid;
alter table public.clients add column if not exists created_at timestamptz not null default now();
alter table public.clients add column if not exists updated_at timestamptz not null default now();

update public.clients
set email = lower(trim(email)), updated_at = coalesce(updated_at, now())
where email <> lower(trim(email));

alter table public.clients drop constraint if exists clients_email_normalized_check;
alter table public.clients add constraint clients_email_normalized_check check (email = lower(trim(email)));
alter table public.clients alter column name set not null;
alter table public.clients alter column email set not null;
create unique index if not exists clients_email_normalized_key on public.clients (email);
create index if not exists clients_status_journey_idx on public.clients (status_journey, updated_at desc);
create index if not exists clients_phone_idx on public.clients (phone) where phone is not null;
create index if not exists clients_document_idx on public.clients (document) where document is not null;

alter table public.clients enable row level security;
drop policy if exists clients_authenticated_select on public.clients;
create policy clients_authenticated_select on public.clients
  for select to authenticated using (true);
drop policy if exists clients_authenticated_insert on public.clients;
create policy clients_authenticated_insert on public.clients
  for insert to authenticated with check (email = lower(trim(email)));
drop policy if exists clients_authenticated_update on public.clients;
create policy clients_authenticated_update on public.clients
  for update to authenticated
  using (true)
  with check (email = lower(trim(email)));
revoke all on public.clients from anon;
grant select, insert, update on public.clients to authenticated;
grant all on public.clients to service_role;

alter table public.purchases enable row level security;
create unique index if not exists purchases_transaction_code_key on public.purchases (transaction_code);
