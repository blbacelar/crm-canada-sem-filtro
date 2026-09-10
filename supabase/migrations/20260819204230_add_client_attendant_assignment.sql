-- Cadastro e associação de atendentes do CRM.
-- O atendente é um operador CRM (perfil consultant) e não um comprador.

create index if not exists clients_assigned_consultant_idx
  on public.clients (assigned_consultant_id, updated_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_assigned_consultant_id_fkey'
      and conrelid = 'public.clients'::regclass
  ) then
    alter table public.clients
      add constraint clients_assigned_consultant_id_fkey
      foreign key (assigned_consultant_id)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

alter table public.clients enable row level security;

-- Apenas administradores podem redistribuir clientes. Atendentes continuam
-- podendo atualizar os próprios clientes conforme as políticas existentes.
drop policy if exists clients_admin_update on public.clients;
drop policy if exists clients_admin_update_assignment on public.clients;
create policy clients_admin_update on public.clients
  for update to authenticated
  using (public.current_user_role() = 'admin')
  with check (
    public.current_user_role() = 'admin'
    and (
      assigned_consultant_id is null
      or exists (
        select 1 from public.profiles p
        where p.id = assigned_consultant_id
          and p.role::text = 'consultant'
          and p.status = 'active'
          and p.archived_at is null
      )
    )
  );
