-- Atomically apply the database side effects of a Hotmart event.
-- The API validates the HOTTOK and prepares the normalized/encrypted JSON.
-- This function makes the client, purchase and diagnostic-access writes one transaction.
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
begin
  insert into public.clients (
    name, email, source, phone, document, country, zip_code, city, state,
    address, district, number, complement, status_journey, updated_at
  )
  select
    c.name, c.email, coalesce(c.source, 'hotmart'), c.phone, c.document, c.country,
    c.zip_code, c.city, c.state, c.address, c.district, c.number, c.complement,
    coalesce(c.status_journey, 'compra'), coalesce(c.updated_at, now())
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
    insert into public.purchases (
      client_id, transaction_code, product_name, price_gross, price_net,
      status_hotmart, purchase_date
    )
    select
      v_client_id, p.transaction_code, p.product_name, p.price_gross, p.price_net,
      p.status_hotmart, p.purchase_date
    from jsonb_to_record(p_purchase) as p(
      transaction_code text, product_name text, price_gross numeric, price_net numeric,
      status_hotmart text, purchase_date timestamptz
    )
    on conflict (transaction_code) do update set
      client_id = excluded.client_id,
      product_name = excluded.product_name,
      price_gross = excluded.price_gross,
      price_net = excluded.price_net,
      status_hotmart = excluded.status_hotmart,
      purchase_date = excluded.purchase_date;
  end if;

  if p_allowed_email is not null and btrim(p_allowed_email) <> '' then
    insert into public.allowed_emails (email)
    values (lower(btrim(p_allowed_email)))
    on conflict (email) do nothing;
  end if;

  return v_client_id;
end;
$$;

revoke all on function public.process_hotmart_event(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.process_hotmart_event(jsonb, jsonb, text) to service_role;
