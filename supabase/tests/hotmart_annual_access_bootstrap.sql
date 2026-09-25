-- Minimal schema for running hotmart_annual_access_test.sql in an isolated PostgreSQL instance.
create role anon;
create role authenticated;
create role service_role;

create schema auth;
create type public.journey_state as enum (
  'compra', 'diagnostico_enviado', 'acompanhamento', 'consulta_marcada',
  'consulta_concluida', 'cancelamento', 'reembolso'
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
grant usage on schema auth to authenticated;
grant execute on all functions in schema auth to authenticated;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  source text default 'hotmart',
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
  status_journey public.journey_state default 'compra',
  updated_at timestamptz default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  transaction_code text not null unique,
  product_name text,
  price_gross numeric,
  price_net numeric,
  status_hotmart text,
  purchase_date timestamptz,
  created_at timestamptz default now()
);

create table public.allowed_emails (
  id bigint generated always as identity primary key,
  email text not null unique,
  active boolean not null default true,
  full_name text,
  source text default 'manual',
  external_reference text,
  last_event text,
  last_event_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.journals (id uuid primary key default gen_random_uuid(), user_id uuid not null);
alter table public.journals enable row level security;
grant select on public.journals to authenticated;
create policy journals_select_own on public.journals for select using (true);
create policy journals_insert_own on public.journals for insert with check (true);
create policy journals_update_own on public.journals for update using (true) with check (true);

create table public.aurora_conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null
);
create policy aurora_conversations_owner_select on public.aurora_conversations for select using (true);
create policy aurora_conversations_owner_insert on public.aurora_conversations for insert with check (true);
create policy aurora_conversations_owner_update on public.aurora_conversations for update using (true) with check (true);
create policy aurora_conversations_owner_delete on public.aurora_conversations for delete using (true);

create table public.aurora_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null
);
create policy aurora_messages_owner_select on public.aurora_messages for select using (true);
create policy aurora_messages_owner_insert on public.aurora_messages for insert with check (true);
create policy aurora_messages_owner_update on public.aurora_messages for update using (true) with check (true);
create policy aurora_messages_owner_delete on public.aurora_messages for delete using (true);

create table public.aurora_usage (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create policy aurora_usage_owner_select on public.aurora_usage for select using (true);
create policy aurora_usage_owner_insert on public.aurora_usage for insert with check (true);
create policy aurora_usage_owner_update on public.aurora_usage for update using (true) with check (true);
