-- The old webhook labeled every new Hotmart lead as "Compra Efetuada".
-- Correct only Hotmart-sourced clients whose every recorded sale expired or
-- was canceled; preserve manual records and every active/paid customer.
update public.clients c
set status_journey = 'cancelamento'::public.journey_state,
    updated_at = now()
where c.source = 'hotmart'
  and c.status_journey = 'compra'::public.journey_state
  and exists (select 1 from public.purchases p where p.client_id = c.id)
  and not exists (
    select 1 from public.purchases p
    where p.client_id = c.id
      and p.status_hotmart not in (
        'PURCHASE_CANCELED', 'PURCHASE_CANCELLED', 'PURCHASE_EXPIRED',
        'CANCELED', 'CANCELLED', 'EXPIRED'
      )
  );
