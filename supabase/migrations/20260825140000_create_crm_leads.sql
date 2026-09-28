create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  calendly_event_id text not null unique,
  calendly_invitee_uri text unique,
  event_type_uri text,
  name text not null,
  email text not null,
  address_and_phone text,
  preparation_notes text,
  status text not null default 'booked' check (status in ('booked', 'canceled')),
  calendly_created_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.crm_leads enable row level security;
revoke all on table public.crm_leads from anon, authenticated;
create index if not exists crm_leads_email_idx on public.crm_leads (lower(email));
create index if not exists crm_leads_status_idx on public.crm_leads (status);
