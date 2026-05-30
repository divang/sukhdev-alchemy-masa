-- Secure launch policy set for public frontend + Supabase anon key.
-- Run this in Supabase SQL Editor after creating public.orders table.

create table if not exists public.orders (
  id text primary key,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  customer_address text not null,
  customer_city text not null,
  customer_pincode text not null,
  items jsonb not null,
  total_amount numeric(10,2) not null check (total_amount >= 0),
  status text not null check (status in ('pending', 'processing', 'shipped', 'delivered')),
  payment_status text not null check (payment_status in ('pending', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;

-- Explicit table privileges (separate from RLS policies).
revoke all on table public.orders from anon;
revoke all on table public.orders from authenticated;
grant insert on table public.orders to anon;
grant insert on table public.orders to authenticated;

-- Clean up permissive demo policies if they exist.
drop policy if exists "Allow anon insert" on public.orders;
drop policy if exists "Allow anon update" on public.orders;
drop policy if exists "Allow anon select" on public.orders;

-- Optional hard reset for similarly named policies.
drop policy if exists "orders_anon_insert_pending" on public.orders;
drop policy if exists "orders_public_insert_pending" on public.orders;
drop policy if exists "orders_anon_select_none" on public.orders;
drop policy if exists "orders_anon_update_none" on public.orders;
drop policy if exists "orders_anon_delete_none" on public.orders;
drop policy if exists "orders_service_all" on public.orders;

-- Allow public checkout flow to create only pending orders.
create policy "orders_public_insert_pending"
on public.orders
for insert
to public
with check (
  status = 'pending'
  and payment_status = 'pending'
  and total_amount >= 0
);

-- Explicitly block public direct reads/updates/deletes.
create policy "orders_anon_select_none"
on public.orders
for select
to anon
using (false);

create policy "orders_anon_update_none"
on public.orders
for update
to anon
using (false)
with check (false);

create policy "orders_anon_delete_none"
on public.orders
for delete
to anon
using (false);

-- Server-side trusted role can do all operations.
create policy "orders_service_all"
on public.orders
for all
to service_role
using (true)
with check (true);
