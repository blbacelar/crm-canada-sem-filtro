begin;

do $$
declare
  v_email text := 'annual-access-check@example.test';
  v_manual_email text := 'annual-manual-check@example.test';
  v_start timestamptz := date_trunc('second', now());
  v_expiry timestamptz;
  v_count integer;
begin
  perform public.process_hotmart_event(
    jsonb_build_object('name', 'Annual Access Check', 'email', v_email),
    jsonb_build_object(
      'transaction_code', 'ANNUAL-ACCESS-CHECK-1', 'product_id', 8575181,
      'product_name', 'Annual product', 'price_gross', 100, 'price_net', 90,
      'status_hotmart', 'PURCHASE_APPROVED', 'purchase_date', v_start,
      'approved_at', v_start, 'event_occurred_at', v_start
    ), v_email
  );

  select access_expires_at into v_expiry
  from public.clients where email = v_email;
  if v_expiry is distinct from v_start + interval '1 year' then
    raise exception 'Annual access expiry was not set from approval date';
  end if;
  if not public.is_email_allowed(v_email) then
    raise exception 'Approved annual purchase did not grant access';
  end if;

  perform public.process_hotmart_event(
    jsonb_build_object('name', 'Annual Access Check', 'email', v_email),
    jsonb_build_object(
      'transaction_code', 'ANNUAL-ACCESS-CHECK-1', 'product_id', 8575181,
      'product_name', 'Annual product', 'price_gross', 100, 'price_net', 90,
      'status_hotmart', 'PURCHASE_APPROVED', 'purchase_date', v_start,
      'approved_at', v_start, 'event_occurred_at', v_start
    ), v_email
  );
  select count(*) into v_count from public.purchases
  where transaction_code = 'ANNUAL-ACCESS-CHECK-1';
  if v_count <> 1 then
    raise exception 'Duplicate event created another purchase';
  end if;

  perform public.process_hotmart_event(
    jsonb_build_object('name', 'Annual Access Check', 'email', v_email),
    jsonb_build_object(
      'transaction_code', 'ANNUAL-ACCESS-CHECK-1', 'product_id', 8575181,
      'product_name', 'Annual product', 'price_gross', 100, 'price_net', 90,
      'status_hotmart', 'PURCHASE_REFUNDED', 'purchase_date', v_start,
      'event_occurred_at', v_start + interval '1 day'
    ), null
  );
  if public.is_email_allowed(v_email) then
    raise exception 'Refunded annual purchase still grants access';
  end if;

  perform public.process_hotmart_event(
    jsonb_build_object('name', 'Annual Access Check', 'email', v_email),
    jsonb_build_object(
      'transaction_code', 'ANNUAL-ACCESS-CHECK-2', 'product_id', 8575181,
      'product_name', 'Annual product', 'price_gross', 100, 'price_net', 90,
      'status_hotmart', 'PURCHASE_APPROVED', 'purchase_date', v_start,
      'approved_at', v_start + interval '2 days',
      'event_occurred_at', v_start + interval '2 days'
    ), v_email
  );
  if not public.is_email_allowed(v_email) then
    raise exception 'A new approved purchase did not restore access';
  end if;

  -- Another product's webhook may change the shared email row. The annual
  -- purchase remains valid until its own expiry or refund.
  update public.allowed_emails set active = false where email = v_email;
  if not public.is_email_allowed(v_email) then
    raise exception 'An unrelated email-row update revoked a valid annual purchase';
  end if;
  update public.allowed_emails set active = true where email = v_email;

  -- A delayed retry of the older approval must not undo its refund.
  perform public.process_hotmart_event(
    jsonb_build_object('name', 'Annual Access Check', 'email', v_email),
    jsonb_build_object(
      'transaction_code', 'ANNUAL-ACCESS-CHECK-1', 'product_id', 8575181,
      'product_name', 'Annual product', 'price_gross', 100, 'price_net', 90,
      'status_hotmart', 'PURCHASE_APPROVED', 'purchase_date', v_start,
      'approved_at', v_start, 'event_occurred_at', v_start
    ), v_email
  );
  select count(*) into v_count from public.purchases
  where transaction_code = 'ANNUAL-ACCESS-CHECK-1'
    and access_expires_at is null;
  if v_count <> 1 then
    raise exception 'A stale approval undid the refund';
  end if;

  insert into public.allowed_emails (email, active, source)
  values (v_manual_email, true, 'manual');
  perform public.process_hotmart_event(
    jsonb_build_object('name', 'Manual Access Check', 'email', v_manual_email),
    jsonb_build_object(
      'transaction_code', 'ANNUAL-MANUAL-CHECK', 'product_id', 8575181,
      'product_name', 'Annual product', 'price_gross', 100, 'price_net', 90,
      'status_hotmart', 'PURCHASE_REFUNDED', 'purchase_date', v_start,
      'event_occurred_at', v_start
    ), null
  );
  if not public.is_email_allowed(v_manual_email) then
    raise exception 'A manual access grant was incorrectly revoked';
  end if;

  update public.allowed_emails
  set access_expires_at = now() - interval '1 second'
  where email = v_email;
  update public.purchases
  set access_expires_at = now() - interval '1 second'
  where transaction_code = 'ANNUAL-ACCESS-CHECK-2';
  if public.is_email_allowed(v_email) then
    raise exception 'Expired annual access was still accepted';
  end if;
end;
$$;

insert into public.allowed_emails (email, active, source, access_expires_at)
values
  ('annual-rls-active@example.test', true, 'hotmart', now() + interval '1 year'),
  ('annual-rls-expired@example.test', true, 'hotmart', now() - interval '1 second');
insert into public.journals (user_id)
values ('11111111-1111-1111-1111-111111111111');

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
set local "request.jwt.claims" = '{"email":"annual-rls-active@example.test"}';
do $$
begin
  if (select count(*) from public.journals) <> 1 then
    raise exception 'An active buyer cannot read their journal';
  end if;
end;
$$;

set local "request.jwt.claims" = '{"email":"annual-rls-expired@example.test"}';
do $$
begin
  if (select count(*) from public.journals) <> 0 then
    raise exception 'An expired buyer can still read their journal';
  end if;
end;
$$;

rollback;
