-- Enrich order_shipments for webhook updates and prevent duplicate created rows.

alter table public.order_shipments
  add column if not exists external_status text,
  add column if not exists external_event_at timestamptz;

create unique index if not exists order_shipments_unique_created_idx
on public.order_shipments(order_id, provider_key)
where shipment_status = 'created';
