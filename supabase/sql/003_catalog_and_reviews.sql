-- Catalog and review tables for dynamic product data.
-- Run after 001_orders_secure_launch.sql and 002_auth_accounts_and_order_ownership.sql.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id text primary key,
  name text not null,
  slug text not null unique,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  category_id text not null references public.categories(id) on delete restrict,
  sku text not null unique,
  name text not null,
  description text not null,
  price_per_100g numeric(10,2) not null check (price_per_100g >= 0),
  image_path text not null,
  rating_avg numeric(3,2) not null default 0 check (rating_avg >= 0 and rating_avg <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  ingredients text[] not null default '{}',
  tags text[] not null default '{}',
  youtube_url text,
  in_stock boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  verified_purchase boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_is_active_idx on public.products(is_active);
create index if not exists product_reviews_product_id_idx on public.product_reviews(product_id);
create index if not exists product_reviews_user_id_idx on public.product_reviews(user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
before update on public.products
for each row
execute function public.touch_updated_at();

drop trigger if exists product_reviews_touch_updated_at on public.product_reviews;
create trigger product_reviews_touch_updated_at
before update on public.product_reviews
for each row
execute function public.touch_updated_at();

-- Keep product rating fields synced from review rows.
create or replace function public.refresh_product_rating_summary(target_product_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products p
  set
    rating_avg = coalesce(summary.avg_rating, 0),
    review_count = coalesce(summary.review_count, 0),
    updated_at = now()
  from (
    select
      product_id,
      round(avg(rating)::numeric, 2) as avg_rating,
      count(*)::int as review_count
    from public.product_reviews
    where product_id = target_product_id
    group by product_id
  ) summary
  where p.id = summary.product_id;

  update public.products p
  set
    rating_avg = 0,
    review_count = 0,
    updated_at = now()
  where p.id = target_product_id
    and not exists (
      select 1
      from public.product_reviews r
      where r.product_id = target_product_id
    );
$$;

create or replace function public.product_reviews_refresh_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_rating_summary(old.product_id);
    return old;
  end if;

  perform public.refresh_product_rating_summary(new.product_id);

  if tg_op = 'UPDATE' and old.product_id <> new.product_id then
    perform public.refresh_product_rating_summary(old.product_id);
  end if;

  return new;
end;
$$;

drop trigger if exists product_reviews_refresh_rating_after_write on public.product_reviews;
create trigger product_reviews_refresh_rating_after_write
after insert or update or delete on public.product_reviews
for each row
execute function public.product_reviews_refresh_trigger();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_reviews enable row level security;

revoke all on table public.categories from anon;
revoke all on table public.categories from authenticated;
revoke all on table public.products from anon;
revoke all on table public.products from authenticated;
revoke all on table public.product_reviews from anon;
revoke all on table public.product_reviews from authenticated;

grant select on table public.categories to anon, authenticated;
grant select on table public.products to anon, authenticated;
grant select on table public.product_reviews to anon, authenticated;
grant insert, update, delete on table public.categories to authenticated;
grant insert, update, delete on table public.products to authenticated;
grant insert, update, delete on table public.product_reviews to authenticated;

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read"
on public.categories
for select
to public
using (true);

drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write"
on public.categories
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read"
on public.products
for select
to public
using (is_active = true);

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write"
on public.products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "product_reviews_public_read" on public.product_reviews;
create policy "product_reviews_public_read"
on public.product_reviews
for select
to public
using (true);

drop policy if exists "product_reviews_owner_insert" on public.product_reviews;
create policy "product_reviews_owner_insert"
on public.product_reviews
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "product_reviews_owner_update" on public.product_reviews;
create policy "product_reviews_owner_update"
on public.product_reviews
for update
to authenticated
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "product_reviews_owner_delete" on public.product_reviews;
create policy "product_reviews_owner_delete"
on public.product_reviews
for delete
to authenticated
using (auth.uid() = user_id or public.is_admin());

comment on table public.categories is 'Product categories managed in database.';
comment on table public.products is 'Product catalog records with dynamic price/stock/review summary.';
comment on table public.product_reviews is 'Per-user product reviews submitted by authenticated users.';
