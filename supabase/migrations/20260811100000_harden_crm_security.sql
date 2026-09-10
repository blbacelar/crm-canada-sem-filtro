-- Hardening de autenticação, RBAC, RLS e Realtime do CRM.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'consultant' check (role in ('admin', 'consultant', 'marketing', 'tech')),
  status text not null default 'active' check (status in ('pending', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists status text not null default 'active';

create table if not exists public.crm_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.crm_settings (key, value)
values (
  'sla',
  '{"targetHours":24,"businessStart":"09:00","businessEnd":"18:00","weekdays":[1,2,3,4,5],"holidays":[]}'::jsonb
)
on conflict (key) do nothing;

insert into public.profiles (id, email, name, role, status)
select
  id,
  coalesce(email, id::text),
  coalesce(raw_user_meta_data ->> 'name', email, id::text),
  (case
    when raw_app_meta_data ->> 'role' in ('admin', 'consultant', 'marketing', 'tech') then raw_app_meta_data ->> 'role'
    when raw_user_meta_data ->> 'role' in ('admin', 'consultant', 'marketing', 'tech') then raw_user_meta_data ->> 'role'
    else 'consultant'
  end)::user_role,
  case when raw_user_meta_data ->> 'status' = 'pending' then 'pending' else 'active' end
from auth.users
on conflict (id) do nothing;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id::text = auth.uid()::text;
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

alter table public.crm_settings enable row level security;
drop policy if exists crm_settings_authenticated_select on public.crm_settings;
create policy crm_settings_authenticated_select on public.crm_settings
  for select to authenticated using (true);
drop policy if exists crm_settings_admin_write on public.crm_settings;
create policy crm_settings_admin_write on public.crm_settings
  for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create or replace function public.handle_new_crm_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, status)
  values (
    new.id,
    coalesce(new.email, new.id::text),
    coalesce(new.raw_user_meta_data ->> 'name', new.email, new.id::text),
    (case
      when new.raw_app_meta_data ->> 'role' in ('admin', 'consultant', 'marketing', 'tech') then new.raw_app_meta_data ->> 'role'
      else 'consultant'
    end)::user_role,
    case when new.raw_user_meta_data ->> 'status' = 'pending' then 'pending' else 'active' end
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(excluded.name, profiles.name),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_crm_profile on auth.users;
create trigger on_auth_user_created_crm_profile
  after insert on auth.users
  for each row execute function public.handle_new_crm_user();

alter table public.profiles enable row level security;
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select to authenticated using (id::text = auth.uid()::text or public.current_user_role() = 'admin');
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

alter table public.clients enable row level security;
drop policy if exists clients_authenticated_select on public.clients;
drop policy if exists clients_authenticated_insert on public.clients;
drop policy if exists clients_authenticated_update on public.clients;
drop policy if exists clients_admin_select on public.clients;
drop policy if exists clients_consultant_select on public.clients;
drop policy if exists clients_admin_insert on public.clients;
drop policy if exists clients_consultant_insert on public.clients;
drop policy if exists clients_admin_update on public.clients;
drop policy if exists clients_consultant_update on public.clients;
create policy clients_admin_select on public.clients
  for select to authenticated using (public.current_user_role() = 'admin');
create policy clients_consultant_select on public.clients
  for select to authenticated using (
    public.current_user_role() = 'consultant'
    and (assigned_consultant_id is null or assigned_consultant_id::text = auth.uid()::text)
  );
create policy clients_admin_insert on public.clients
  for insert to authenticated with check (public.current_user_role() = 'admin');
create policy clients_consultant_insert on public.clients
  for insert to authenticated with check (public.current_user_role() = 'consultant');
create policy clients_admin_update on public.clients
  for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy clients_consultant_update on public.clients
  for update to authenticated
  using (public.current_user_role() = 'consultant' and (assigned_consultant_id is null or assigned_consultant_id::text = auth.uid()::text))
  with check (public.current_user_role() = 'consultant' and (assigned_consultant_id is null or assigned_consultant_id::text = auth.uid()::text));

alter table public.purchases enable row level security;
drop policy if exists purchases_authenticated_select on public.purchases;
drop policy if exists purchases_admin_select on public.purchases;
drop policy if exists purchases_consultant_select on public.purchases;
create policy purchases_admin_select on public.purchases
  for select to authenticated using (public.current_user_role() = 'admin');
create policy purchases_consultant_select on public.purchases
  for select to authenticated using (
    public.current_user_role() = 'consultant'
    and exists (
      select 1 from public.clients c
      where c.id = purchases.client_id
        and (c.assigned_consultant_id is null or c.assigned_consultant_id::text = auth.uid()::text)
    )
  );

alter table public.interactions enable row level security;
drop policy if exists interactions_authenticated_select on public.interactions;
drop policy if exists interactions_authenticated_insert on public.interactions;
drop policy if exists interactions_admin_all on public.interactions;
drop policy if exists interactions_consultant_access on public.interactions;
create policy interactions_admin_all on public.interactions
  for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy interactions_consultant_access on public.interactions
  for select to authenticated using (
    public.current_user_role() = 'consultant'
    and exists (select 1 from public.clients c where c.id = interactions.client_id and (c.assigned_consultant_id is null or c.assigned_consultant_id::text = auth.uid()::text))
  );
create policy interactions_consultant_insert on public.interactions
  for insert to authenticated with check (public.current_user_role() = 'consultant' and consultant_id::text = auth.uid()::text);

alter table public.events_log enable row level security;
drop policy if exists events_log_authenticated_select on public.events_log;
create policy events_log_admin_tech_select on public.events_log
  for select to authenticated using (public.current_user_role() in ('admin', 'tech'));

alter table public.commissions_config enable row level security;
drop policy if exists commissions_config_authenticated_select on public.commissions_config;
create policy commissions_config_authenticated_select on public.commissions_config
  for select to authenticated using (public.current_user_role() in ('admin', 'consultant', 'marketing'));
drop policy if exists commissions_config_admin_write on public.commissions_config;
create policy commissions_config_admin_write on public.commissions_config
  for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

alter table public.commissions_log enable row level security;
drop policy if exists commissions_log_authenticated_select on public.commissions_log;
create policy commissions_log_admin_select on public.commissions_log
  for select to authenticated using (public.current_user_role() = 'admin');
create policy commissions_log_consultant_select on public.commissions_log
  for select to authenticated using (public.current_user_role() = 'consultant' and consultant_id::text = auth.uid()::text);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'clients'
  ) then
    alter publication supabase_realtime add table public.clients;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'purchases'
  ) then
    alter publication supabase_realtime add table public.purchases;
  end if;
end $$;
