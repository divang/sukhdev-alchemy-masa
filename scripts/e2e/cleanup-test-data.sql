-- E2E cleanup script (safe-by-default): deletes only records tagged as test data.
-- Optional filters:
--   set local app.e2e_test_run_id = 'e2e-order-flow-...';
--   set local app.e2e_cutoff_hours = '24';

begin;

with params as (
  select
    nullif(current_setting('app.e2e_test_run_id', true), '') as target_run_id,
    coalesce(nullif(current_setting('app.e2e_cutoff_hours', true), '')::int, 24) as cutoff_hours
),
eligible_orders as (
  select o.id
  from public.orders o
  cross join params p
  where o.is_test = true
    and o.created_at <= (now() - make_interval(hours => p.cutoff_hours))
    and (p.target_run_id is null or o.test_run_id = p.target_run_id)
),
deleted_shipments as (
  delete from public.order_shipments os
  using eligible_orders eo
  where os.order_id = eo.id
    and os.is_test = true
  returning os.id
),
deleted_payments as (
  delete from public.billing_payments bp
  using eligible_orders eo
  where bp.order_id = eo.id
    and bp.is_test = true
  returning bp.id
),
deleted_items as (
  delete from public.order_items oi
  using eligible_orders eo
  where oi.order_id = eo.id
  returning oi.id
),
deleted_orders as (
  delete from public.orders o
  using eligible_orders eo
  where o.id = eo.id
    and o.is_test = true
  returning o.id
)
select
  (select count(*) from deleted_shipments) as deleted_shipments,
  (select count(*) from deleted_payments) as deleted_payments,
  (select count(*) from deleted_items) as deleted_order_items,
  (select count(*) from deleted_orders) as deleted_orders;

commit;
