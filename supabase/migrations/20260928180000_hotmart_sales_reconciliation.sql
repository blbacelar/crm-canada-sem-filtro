-- Keep the complete sales API response private while exposing the purchase
-- fields the CRM needs for its customer history.
alter table public.purchases
  add column if not exists payment_method text,
  add column if not exists installments integer,
  add column if not exists currency_code text,
  add column if not exists offer_code text,
  add column if not exists is_subscription boolean,
  add column if not exists hotmart_fee numeric,
  add column if not exists hotmart_synced_at timestamptz;

-- Net proceeds cannot be inferred from the offer price or an arbitrary fee.
-- Leave them unknown when the commissions endpoint has no comparable value.
alter table public.purchases alter column price_net drop not null;

create table if not exists public.hotmart_sale_snapshots (
  transaction_code text primary key references public.purchases(transaction_code) on delete cascade,
  history jsonb not null,
  participants jsonb,
  commissions jsonb,
  price_details jsonb,
  synced_at timestamptz not null default now()
);

alter table public.hotmart_sale_snapshots enable row level security;
revoke all on public.hotmart_sale_snapshots from public, anon, authenticated;
grant select, insert, update, delete on public.hotmart_sale_snapshots to service_role;

-- One database transaction updates the customer, purchase, entitlement and
-- API snapshot. A webhook with a newer event timestamp wins a race.
create or replace function public.sync_hotmart_sale(
  p_client jsonb,
  p_purchase jsonb,
  p_snapshot jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_client_id uuid;
  v_transaction text;
  v_event_at timestamptz;
  v_history_purchase jsonb;
begin
  v_transaction := nullif(p_purchase ->> 'transaction_code', '');
  v_event_at := nullif(p_purchase ->> 'event_occurred_at', '')::timestamptz;
  if v_transaction is null or v_event_at is null or p_snapshot -> 'history' is null then
    raise exception 'Incomplete Hotmart sale snapshot';
  end if;

  v_client_id := public.process_hotmart_event(p_client, p_purchase, null);
  v_history_purchase := p_snapshot -> 'history' -> 'purchase';

  update public.purchases
  set payment_method = coalesce(
        v_history_purchase -> 'payment' ->> 'method',
        v_history_purchase -> 'payment' ->> 'type'
      ),
      installments = nullif(v_history_purchase -> 'payment' ->> 'installments_number', '')::integer,
      currency_code = coalesce(
        v_history_purchase -> 'price' ->> 'currency_code',
        v_history_purchase -> 'price' ->> 'currency_value'
      ),
      offer_code = v_history_purchase -> 'offer' ->> 'code',
      is_subscription = nullif(v_history_purchase ->> 'is_subscription', '')::boolean,
      hotmart_fee = nullif(v_history_purchase -> 'hotmart_fee' ->> 'total', '')::numeric,
      hotmart_synced_at = now()
  where transaction_code = v_transaction
    and last_event_at = v_event_at;

  if found then
    insert into public.hotmart_sale_snapshots (
      transaction_code, history, participants, commissions, price_details, synced_at
    ) values (
      v_transaction, p_snapshot -> 'history', p_snapshot -> 'participants',
      p_snapshot -> 'commissions', p_snapshot -> 'price_details', now()
    )
    on conflict (transaction_code) do update set
      history = excluded.history,
      participants = excluded.participants,
      commissions = excluded.commissions,
      price_details = excluded.price_details,
      synced_at = excluded.synced_at;
  end if;

  return v_client_id;
end;
$$;

revoke all on function public.sync_hotmart_sale(jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_hotmart_sale(jsonb, jsonb, jsonb)
  to service_role;

notify pgrst, 'reload schema';
