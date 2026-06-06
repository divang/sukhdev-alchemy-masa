-- Shiprocket rollout controls + shipment event log table.

insert into public.feature_flags (key, enabled, description)
values (
  'enable_shiprocket_integration',
  false,
  'When enabled, paid orders attempt shipment creation with the active delivery partner (Shiprocket first).'
)
on conflict (key) do update
set
  description = excluded.description,
  updated_at = now();

create table if not exists public.order_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  provider_key text not null,
  shipment_status text not null,
  shipment_id text,
  awb_code text,
  tracking_url text,
  error_message text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.order_shipments
  add constraint order_shipments_provider_key_check
  check (provider_key in ('shiprocket', 'delhivery', 'nimbuspost', 'smartship'));

alter table public.order_shipments
  add constraint order_shipments_status_check
  check (shipment_status in ('created', 'pending', 'skipped', 'failed'));

create index if not exists order_shipments_order_id_idx on public.order_shipments(order_id);
create index if not exists order_shipments_provider_key_idx on public.order_shipments(provider_key);

drop trigger if exists order_shipments_touch_updated_at on public.order_shipments;
create trigger order_shipments_touch_updated_at
before update on public.order_shipments
for each row
execute function public.touch_updated_at();

alter table public.order_shipments enable row level security;

revoke all on table public.order_shipments from anon;
revoke all on table public.order_shipments from authenticated;

grant select on table public.order_shipments to authenticated;
grant insert, update, delete on table public.order_shipments to service_role;

drop policy if exists "order_shipments_customer_or_admin_read" on public.order_shipments;
create policy "order_shipments_customer_or_admin_read"
on public.order_shipments
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.orders o
    where o.id = order_shipments.order_id
      and o.user_id = auth.uid()
  )
);

drop policy if exists "order_shipments_service_all" on public.order_shipments;
create policy "order_shipments_service_all"
on public.order_shipments
for all
to service_role
using (true)
with check (true);