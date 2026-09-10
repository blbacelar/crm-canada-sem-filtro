create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  instance_name text not null,
  remote_jid text not null,
  client_id uuid references public.clients(id) on delete set null,
  contact_name text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_name, remote_jid)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  instance_name text not null,
  message_id text not null,
  remote_jid text not null,
  client_id uuid references public.clients(id) on delete set null,
  from_me boolean not null default false,
  message_type text,
  text_content text,
  status text,
  message_timestamp timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (instance_name, message_id)
);

create index if not exists whatsapp_messages_conversation_idx
  on public.whatsapp_messages (conversation_id, message_timestamp desc);
create index if not exists whatsapp_messages_client_idx
  on public.whatsapp_messages (client_id, message_timestamp desc);

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

drop policy if exists whatsapp_conversations_admin_select on public.whatsapp_conversations;
create policy whatsapp_conversations_admin_select on public.whatsapp_conversations
  for select to authenticated using (public.current_user_role() = 'admin');
drop policy if exists whatsapp_conversations_assigned_select on public.whatsapp_conversations;
create policy whatsapp_conversations_assigned_select on public.whatsapp_conversations
  for select to authenticated using (
    public.current_user_role() = 'consultant'
    and exists (select 1 from public.clients c where c.id = whatsapp_conversations.client_id and c.assigned_consultant_id = auth.uid())
  );

drop policy if exists whatsapp_messages_admin_select on public.whatsapp_messages;
create policy whatsapp_messages_admin_select on public.whatsapp_messages
  for select to authenticated using (public.current_user_role() = 'admin');
drop policy if exists whatsapp_messages_assigned_select on public.whatsapp_messages;
create policy whatsapp_messages_assigned_select on public.whatsapp_messages
  for select to authenticated using (
    public.current_user_role() = 'consultant'
    and exists (select 1 from public.clients c where c.id = whatsapp_messages.client_id and c.assigned_consultant_id = auth.uid())
  );
