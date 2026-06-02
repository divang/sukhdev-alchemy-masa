-- Promo codes managed by admin and applied by authenticated customers at checkout.

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_scope text not null check (discount_scope in ('shipping', 'subtotal', 'total')),
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  max_discount_amount numeric(10,2) check (max_discount_amount >= 0),
  min_order_amount numeric(10,2) check (min_order_amount >= 0),
  is_active boolean not null default true,
  valid_from timestamptz,
  valid_until timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promo_codes_code_idx on public.promo_codes (code);
create index if not exists promo_codes_active_idx on public.promo_codes (is_active);

alter table public.promo_codes enable row level security;

revoke all on table public.promo_codes from anon;
revoke all on table public.promo_codes from authenticated;
grant select on table public.promo_codes to authenticated;
grant insert, update, delete on table public.promo_codes to authenticated;

drop policy if exists "promo_codes_authenticated_read_active" on public.promo_codes;
drop policy if exists "promo_codes_admin_manage" on public.promo_codes;
drop policy if exists "promo_codes_service_all" on public.promo_codes;

create policy "promo_codes_authenticated_read_active"
on public.promo_codes
for select
to authenticated
using (is_active = true or public.is_admin());

create policy "promo_codes_admin_manage"
on public.promo_codes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "promo_codes_service_all"
on public.promo_codes
for all
to service_role
using (true)
with check (true);

insert into public.promo_codes (
  code,
  description,
  discount_scope,
  discount_type,
  discount_value,
  max_discount_amount,
  min_order_amount,
  is_active
)
values (
  'SDAJUNE26',
  'Launch promo: free shipping discount',
  'shipping',
  'percent',
  100,
  120,
  0,
  true
)
on conflict (code) do update
set
  description = excluded.description,
  discount_scope = excluded.discount_scope,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  max_discount_amount = excluded.max_discount_amount,
  min_order_amount = excluded.min_order_amount,
  is_active = excluded.is_active,
  updated_at = now();
