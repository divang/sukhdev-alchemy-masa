-- Authenticated account model for customers and admins.
-- Run after 001_orders_secure_launch.sql.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'customer' check (role in ('customer', 'admin')),
  review_opt_in boolean not null default true,
  marketing_opt_in boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists orders_user_id_idx on public.orders(user_id);

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select, insert, update on table public.profiles to authenticated;

revoke all on table public.orders from anon;
revoke all on table public.orders from authenticated;
grant select, insert, update on table public.orders to authenticated;

drop policy if exists "orders_public_insert_pending" on public.orders;
drop policy if exists "orders_anon_select_none" on public.orders;
drop policy if exists "orders_anon_update_none" on public.orders;
drop policy if exists "orders_anon_delete_none" on public.orders;
drop policy if exists "profiles_self_select" on public.profiles;
drop policy if exists "profiles_self_insert" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
drop policy if exists "orders_customer_insert_own_pending" on public.orders;
drop policy if exists "orders_customer_select_own" on public.orders;
drop policy if exists "orders_admin_update_all" on public.orders;
drop policy if exists "orders_service_all" on public.orders;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

create policy "profiles_self_select"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.is_admin()
);

create policy "profiles_self_insert"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_self_update"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or public.is_admin()
)
with check (
  auth.uid() = id
  or public.is_admin()
);

create policy "orders_customer_insert_own_pending"
on public.orders
for insert
to authenticated
with check (
  auth.uid() = user_id
  and status = 'pending'
  and payment_status = 'pending'
  and total_amount >= 0
);

create policy "orders_customer_select_own"
on public.orders
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_admin()
);

create policy "orders_admin_update_all"
on public.orders
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "orders_service_all"
on public.orders
for all
to service_role
using (true)
with check (true);

comment on function public.is_admin() is 'Returns true when the signed-in user has admin role in public.profiles.';

-- Promote your first admin after signing up once as a normal user:
-- update public.profiles set role = 'admin' where email = 'you@example.com';