-- Add E2E test tagging fields so automation records can be traced and cleaned safely.

alter table public.orders
  add column if not exists is_test boolean not null default false,
  add column if not exists test_run_id text,
  add column if not exists test_scenario text,
  add column if not exists test_created_by text;

alter table public.billing_payments
  add column if not exists is_test boolean not null default false,
  add column if not exists test_run_id text,
  add column if not exists test_scenario text,
  add column if not exists test_created_by text;

alter table public.order_shipments
  add column if not exists is_test boolean not null default false,
  add column if not exists test_run_id text,
  add column if not exists test_scenario text,
  add column if not exists test_created_by text;

create index if not exists orders_is_test_idx on public.orders(is_test);
create index if not exists orders_test_run_id_idx on public.orders(test_run_id);

create index if not exists billing_payments_is_test_idx on public.billing_payments(is_test);
create index if not exists billing_payments_test_run_id_idx on public.billing_payments(test_run_id);

create index if not exists order_shipments_is_test_idx on public.order_shipments(is_test);
create index if not exists order_shipments_test_run_id_idx on public.order_shipments(test_run_id);
