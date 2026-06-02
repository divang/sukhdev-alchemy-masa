-- Persist signed-in cart items and restrict reviews to paid purchasers.
-- Run after 004_catalog_seed_data.sql and 005_testimonials.sql.

create table if not exists public.cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  grams integer not null check (grams > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id, grams)
);

create index if not exists cart_items_user_id_idx on public.cart_items(user_id);

drop trigger if exists cart_items_touch_updated_at on public.cart_items;
create trigger cart_items_touch_updated_at
before update on public.cart_items
for each row
execute function public.touch_updated_at();

alter table public.cart_items enable row level security;

revoke all on table public.cart_items from anon;
revoke all on table public.cart_items from authenticated;
grant select, insert, update, delete on table public.cart_items to authenticated;

drop policy if exists "cart_items_owner_select" on public.cart_items;
create policy "cart_items_owner_select"
on public.cart_items
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "cart_items_owner_insert" on public.cart_items;
create policy "cart_items_owner_insert"
on public.cart_items
for insert
to authenticated
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "cart_items_owner_update" on public.cart_items;
create policy "cart_items_owner_update"
on public.cart_items
for update
to authenticated
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "cart_items_owner_delete" on public.cart_items;
create policy "cart_items_owner_delete"
on public.cart_items
for delete
to authenticated
using (auth.uid() = user_id or public.is_admin());

create or replace function public.has_purchased_product(target_product_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    cross join lateral jsonb_array_elements(o.items) as item
    where o.user_id = auth.uid()
      and o.payment_status = 'paid'
      and item ->> 'productId' = target_product_id
  );
$$;

grant execute on function public.has_purchased_product(text) to authenticated;

drop policy if exists "product_reviews_owner_insert" on public.product_reviews;
create policy "product_reviews_owner_insert"
on public.product_reviews
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.has_purchased_product(product_id)
);

drop policy if exists "product_reviews_owner_update" on public.product_reviews;
create policy "product_reviews_owner_update"
on public.product_reviews
for update
to authenticated
using (auth.uid() = user_id or public.is_admin())
with check (
  (auth.uid() = user_id and public.has_purchased_product(product_id))
  or public.is_admin()
);

comment on table public.cart_items is 'Signed-in customer cart items persisted for wishlist and recovery workflows.';
comment on function public.has_purchased_product(text) is 'Returns true when the signed-in user has at least one paid order containing the requested product.';