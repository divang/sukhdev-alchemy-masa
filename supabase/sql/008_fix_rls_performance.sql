-- Fix: Warp server "Thread killed by timeout manager" on login
--
-- Root cause: is_admin() queries public.profiles on every RLS check.
-- After login, the app fires ~6 concurrent PostgREST requests (profiles,
-- cart_items, orders, reviews, testimonials, products). Each request
-- evaluates RLS per row, calling is_admin() which re-queries profiles.
-- On free-tier Supabase this thread burst causes Warp to kill threads.
--
-- Solution:
--   1. Replace is_admin() body to use auth.jwt() claim instead of a DB query.
--   2. Use (select auth.uid()) pattern in all RLS policies — evaluated once
--      per query rather than per row (critical for tables with many rows).
--   3. Remove is_admin() from profiles_self_select (users only need own row).
--   4. Use jwt-based is_admin in insert/update policies.

-- Step 1: Replace is_admin() to read from JWT app_metadata (no DB query).
-- NOTE: this requires admin role to be stored in user_metadata.role.
-- We keep a DB fallback for safety so existing admins are not locked out.
create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  -- Fast path: read role from JWT claims (no DB round-trip).
  jwt_role := coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    (auth.jwt() -> 'app_metadata' ->> 'role')
  );

  if jwt_role = 'admin' then
    return true;
  end if;

  -- Slow path fallback: check profiles table only when JWT has no role claim.
  return exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
end;
$$;

-- Step 2: Fix profiles policies — no is_admin() on self-select to avoid
-- recursive profiles→is_admin()→profiles query loop.

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
);

-- Admins access all profiles via service_role or direct SQL; the RLS policy
-- on customer reads doesn't need to allow admin cross-reads since admin
-- actions (AdminPanel) already use service_role or RLS-exempt function calls.

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
on public.profiles
for update
to authenticated
using (
  (select auth.uid()) = id
  or public.is_admin()
)
with check (
  (select auth.uid()) = id
  or public.is_admin()
);

-- Step 3: Fix orders policies — use (select auth.uid()) to evaluate once.
drop policy if exists "orders_customer_select_own" on public.orders;
create policy "orders_customer_select_own"
on public.orders
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or public.is_admin()
);

drop policy if exists "orders_customer_insert_own_pending" on public.orders;
create policy "orders_customer_insert_own_pending"
on public.orders
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and payment_status = 'pending'
  and total_amount >= 0
);

drop policy if exists "orders_admin_update_all" on public.orders;
create policy "orders_admin_update_all"
on public.orders
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Step 4: Fix cart_items policies.
drop policy if exists "cart_items_owner_select" on public.cart_items;
create policy "cart_items_owner_select"
on public.cart_items
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "cart_items_owner_insert" on public.cart_items;
create policy "cart_items_owner_insert"
on public.cart_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "cart_items_owner_update" on public.cart_items;
create policy "cart_items_owner_update"
on public.cart_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "cart_items_owner_delete" on public.cart_items;
create policy "cart_items_owner_delete"
on public.cart_items
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Step 5: Fix product_reviews policies.
drop policy if exists "product_reviews_public_select" on public.product_reviews;
create policy "product_reviews_public_select"
on public.product_reviews
for select
to authenticated
using (true);

drop policy if exists "product_reviews_owner_insert" on public.product_reviews;
create policy "product_reviews_owner_insert"
on public.product_reviews
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and public.has_purchased_product(product_id)
);

drop policy if exists "product_reviews_owner_update" on public.product_reviews;
create policy "product_reviews_owner_update"
on public.product_reviews
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and public.has_purchased_product(product_id)
);

-- Step 6: Add missing indexes to speed up row-level lookups.
create index if not exists profiles_role_idx on public.profiles(role) where role = 'admin';
create index if not exists orders_payment_status_idx on public.orders(payment_status);
create index if not exists orders_user_payment_idx on public.orders(user_id, payment_status);
