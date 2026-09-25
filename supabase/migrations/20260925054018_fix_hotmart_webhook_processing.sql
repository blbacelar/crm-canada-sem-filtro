-- Keep the webhook ledger able to retain the root cause of a processing failure.
-- This is intentionally additive so previously received events remain intact.
alter table public.events_log
  add column if not exists error_message text;

comment on column public.events_log.error_message is
  'Failure detail captured when a webhook event cannot be processed.';

-- `jsonb_to_record` materializes JSON scalars as text. The production column is
-- a journey_state enum, so the value must be cast before the upsert.
create or replace function public.process_hotmart_event(
  p_client jsonb,
  p_purchase jsonb,
  p_allowed_email text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_client_id uuid;
  v_product_id bigint;
  v_transaction text;
  v_event_type text;
  v_event_at timestamptz;
  v_approved_at timestamptz;
  v_purchase_expiry timestamptz;
  v_latest_expiry timestamptz;
  v_active_transaction text;
  v_is_grant boolean;
  v_is_revoke boolean;
begin
  insert into public.clients (
    name, email, source, phone, document, country, zip_code, city, state,
    address, district, number, complement, status_journey, updated_at
  )
  select
    c.name, c.email, coalesce(c.source, 'hotmart'), c.phone, c.document, c.country,
    c.zip_code, c.city, c.state, c.address, c.district, c.number, c.complement,
    coalesce(c.status_journey, 'compra')::public.journey_state,
    coalesce(c.updated_at, now())
  from jsonb_to_record(p_client) as c(
    name text, email text, source text, phone text, document text, country text,
    zip_code text, city text, state text, address text, district text, number text,
    complement text, status_journey text, updated_at timestamptz
  )
  on conflict (email) do update set
    name = excluded.name,
    source = excluded.source,
    phone = coalesce(excluded.phone, public.clients.phone),
    document = coalesce(excluded.document, public.clients.document),
    country = coalesce(excluded.country, public.clients.country),
    zip_code = coalesce(excluded.zip_code, public.clients.zip_code),
    city = coalesce(excluded.city, public.clients.city),
    state = coalesce(excluded.state, public.clients.state),
    address = coalesce(excluded.address, public.clients.address),
    district = coalesce(excluded.district, public.clients.district),
    number = coalesce(excluded.number, public.clients.number),
    complement = coalesce(excluded.complement, public.clients.complement),
    status_journey = excluded.status_journey,
    updated_at = now()
  returning id into v_client_id;

  if p_purchase is not null and p_purchase ? 'transaction_code' then
    v_transaction := p_purchase ->> 'transaction_code';
    v_product_id := nullif(p_purchase ->> 'product_id', '')::bigint;
    if v_product_id is null then
      select product_id into v_product_id
      from public.purchases where transaction_code = v_transaction;
    end if;
    v_event_type := upper(coalesce(p_purchase ->> 'status_hotmart', ''));
    v_event_at := coalesce(nullif(p_purchase ->> 'event_occurred_at', '')::timestamptz, now());
    v_approved_at := nullif(p_purchase ->> 'approved_at', '')::timestamptz;
    v_is_grant := v_event_type in (
      'PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'PURCHASE_COMPLETED', 'APPROVED', 'COMPLETE'
    );
    v_is_revoke := v_event_type in (
      'PURCHASE_CANCELED', 'PURCHASE_CANCELLED', 'PURCHASE_REFUNDED',
      'PURCHASE_CHARGEBACK', 'PURCHASE_EXPIRED', 'PURCHASE_OVERDUE',
      'CANCELED', 'CANCELLED', 'REFUNDED', 'CHARGEBACK', 'EXPIRED', 'OVERDUE'
    );

    if v_product_id = 8575181 and v_is_grant then
      v_purchase_expiry := coalesce(v_approved_at, v_event_at) + interval '1 year';
    end if;

    insert into public.purchases (
      client_id, transaction_code, product_id, product_name, price_gross,
      price_net, status_hotmart, purchase_date, last_event_at, access_expires_at
    )
    values (
      v_client_id, v_transaction, v_product_id, p_purchase ->> 'product_name',
      (p_purchase ->> 'price_gross')::numeric,
      (p_purchase ->> 'price_net')::numeric,
      v_event_type, (p_purchase ->> 'purchase_date')::timestamptz,
      v_event_at, v_purchase_expiry
    )
    on conflict (transaction_code) do update set
      client_id = excluded.client_id,
      product_id = coalesce(excluded.product_id, public.purchases.product_id),
      product_name = excluded.product_name,
      price_gross = excluded.price_gross,
      price_net = excluded.price_net,
      status_hotmart = excluded.status_hotmart,
      purchase_date = excluded.purchase_date,
      last_event_at = excluded.last_event_at,
      access_expires_at = case
        when v_product_id = 8575181 and (v_is_grant or v_is_revoke)
          then excluded.access_expires_at
        else public.purchases.access_expires_at
      end
    where public.purchases.last_event_at is null
      or excluded.last_event_at >= public.purchases.last_event_at;

    if v_product_id = 8575181 and (v_is_grant or v_is_revoke) then
      select access_expires_at, transaction_code
      into v_latest_expiry, v_active_transaction
      from public.purchases
      where client_id = v_client_id
        and product_id = 8575181
        and access_expires_at is not null
      order by access_expires_at desc
      limit 1;

      update public.clients
      set access_expires_at = v_latest_expiry, updated_at = now()
      where id = v_client_id;

      insert into public.allowed_emails (
        email, active, source, external_reference, last_event, last_event_at,
        access_product_id, access_expires_at, updated_at
      )
      values (
        lower(btrim(p_client ->> 'email')), v_latest_expiry is not null,
        'hotmart', coalesce(v_active_transaction, v_transaction),
        case when v_latest_expiry is not null then 'PURCHASE_APPROVED' else v_event_type end,
        v_event_at, 8575181, v_latest_expiry, now()
      )
      on conflict (email) do update set
        active = excluded.active,
        external_reference = excluded.external_reference,
        last_event = excluded.last_event,
        last_event_at = excluded.last_event_at,
        access_product_id = excluded.access_product_id,
        access_expires_at = excluded.access_expires_at,
        updated_at = now()
      where public.allowed_emails.source is distinct from 'manual'
        and (public.allowed_emails.access_product_id = 8575181
          or public.allowed_emails.external_reference is null
          or public.allowed_emails.external_reference = v_transaction)
        and (public.allowed_emails.last_event_at is null
          or public.allowed_emails.last_event_at <= v_event_at);
    end if;
  end if;

  if v_product_id is distinct from 8575181
    and p_allowed_email is not null and btrim(p_allowed_email) <> '' then
    insert into public.allowed_emails (email)
    values (lower(btrim(p_allowed_email)))
    on conflict (email) do nothing;
  end if;

  return v_client_id;
end;
$$;

revoke all on function public.process_hotmart_event(jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.process_hotmart_event(jsonb, jsonb, text)
  to service_role;
