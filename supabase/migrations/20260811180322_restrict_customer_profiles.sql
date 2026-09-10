-- Usuários que compraram o curso podem existir no Auth, mas não são operadores do CRM.
-- Mantemos o perfil para identidade/auditoria e bloqueamos o acesso com status pending.
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

update public.profiles p
set status = 'pending', updated_at = now()
from auth.users u
where u.id::text = p.id::text
  and exists (
    select 1
    from public.clients c
    where lower(c.email) = lower(p.email)
  )
  and coalesce(u.raw_app_meta_data ->> 'role', '') not in ('admin', 'tech');

-- Todo novo usuário precisa ser aprovado explicitamente antes de acessar o CRM.
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
    'pending'
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(excluded.name, profiles.name),
    updated_at = now();
  return new;
end;
$$;
