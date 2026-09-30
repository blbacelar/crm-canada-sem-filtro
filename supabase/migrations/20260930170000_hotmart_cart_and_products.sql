-- An abandoned checkout has no transaction. Keep it separate from purchases.
alter type public.journey_state add value if not exists 'carrinho_abandonado';
alter type public.journey_state add value if not exists 'pagamento_pendente';

alter table public.events_log add column if not exists external_event_id text;
alter table public.events_log add column if not exists reconciled_at timestamptz;
create unique index if not exists events_log_hotmart_event_id_key
  on public.events_log (external_event_id) where external_event_id is not null;

-- Historical webhook rows were left pending by the old handler, while the
-- authoritative sales API has since reconciled those transactions.
update public.events_log e
set status_processing = 'processed', reconciled_at = now()
where e.status_processing = 'pending'
  and exists (
    select 1 from public.hotmart_sale_snapshots s
    where s.transaction_code = e.transaction_code
  );

-- Old deliveries contain repeated event IDs. Claim each ID once without
-- rewriting the raw delivery history or deleting duplicate rows.
with selected as (
  select distinct on (payload ->> 'id') id, payload ->> 'id' as event_id
  from public.events_log
  where nullif(payload ->> 'id', '') is not null
  order by payload ->> 'id', (status_processing = 'processed') desc, received_at desc
)
update public.events_log e
set external_event_id = selected.event_id
from selected
where e.id = selected.id;

create table if not exists public.hotmart_cart_abandonments (
  event_id text primary key,
  client_id uuid not null references public.clients(id) on delete cascade,
  buyer_email text not null check (buyer_email = lower(btrim(buyer_email))),
  product_id bigint,
  product_name text not null,
  offer_code text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists hotmart_cart_abandonments_client_idx
  on public.hotmart_cart_abandonments (client_id, occurred_at desc);
alter table public.hotmart_cart_abandonments enable row level security;
revoke all on public.hotmart_cart_abandonments from public, anon, authenticated;
grant select, insert, update on public.hotmart_cart_abandonments to service_role;

create table if not exists public.hotmart_purchase_products (
  transaction_code text not null references public.purchases(transaction_code) on delete cascade,
  product_id bigint not null,
  product_name text not null,
  primary key (transaction_code, product_id)
);
alter table public.hotmart_purchase_products enable row level security;
revoke all on public.hotmart_purchase_products from public, anon, authenticated;
grant select, insert, update on public.hotmart_purchase_products to service_role;

-- Recover bundle contents already delivered in old webhooks, but only for
-- transactions independently confirmed in the purchases table. Sandbox events
-- in the ledger must never become customer purchases.
insert into public.hotmart_purchase_products (transaction_code, product_id, product_name)
select distinct on (e.transaction_code, (item ->> 'id')::bigint)
  e.transaction_code, (item ->> 'id')::bigint, item ->> 'name'
from public.events_log e
join public.purchases p on p.transaction_code = e.transaction_code
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(e.payload -> 'data' -> 'product' -> 'content' -> 'products') = 'array'
    then e.payload -> 'data' -> 'product' -> 'content' -> 'products'
    else '[]'::jsonb end
) as item
where item ->> 'id' ~ '^[0-9]+$'
  and nullif(btrim(item ->> 'name'), '') is not null
order by e.transaction_code, (item ->> 'id')::bigint, e.received_at desc
on conflict (transaction_code, product_id) do nothing;

-- Create only genuinely new prospects; existing customers keep their CRM journey.
create or replace function public.record_hotmart_cart_abandonment(
  p_client jsonb,
  p_cart jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_client_id uuid;
  v_email text := lower(btrim(p_client ->> 'email'));
begin
  if v_email is null or v_email = ''
    or nullif(p_cart ->> 'event_id', '') is null
    or nullif(p_cart ->> 'occurred_at', '') is null then
    raise exception 'Incomplete Hotmart cart event';
  end if;

  insert into public.clients (name, email, phone, source, status_journey)
  values (
    coalesce(nullif(btrim(p_client ->> 'name'), ''), 'Lead Hotmart'),
    v_email,
    nullif(p_client ->> 'phone', ''),
    'hotmart',
    'carrinho_abandonado'::public.journey_state
  )
  on conflict (email) do nothing;

  select id into v_client_id from public.clients where email = v_email;
  insert into public.hotmart_cart_abandonments (
    event_id, client_id, buyer_email, product_id, product_name, offer_code, occurred_at
  ) values (
    p_cart ->> 'event_id', v_client_id, v_email,
    nullif(p_cart ->> 'product_id', '')::bigint,
    coalesce(nullif(p_cart ->> 'product_name', ''), 'Produto Hotmart'),
    nullif(p_cart ->> 'offer_code', ''),
    (p_cart ->> 'occurred_at')::timestamptz
  ) on conflict (event_id) do nothing;
  return v_client_id;
end;
$$;
revoke all on function public.record_hotmart_cart_abandonment(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_hotmart_cart_abandonment(jsonb, jsonb)
  to service_role;

notify pgrst, 'reload schema';
