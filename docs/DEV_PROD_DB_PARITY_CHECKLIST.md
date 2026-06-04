# Dev/Prod Supabase Segregation Checklist

This checklist is for Phase 2: keep development and production data fully separated while preserving schema parity.

## 1) Create Two Supabase Projects

Create two independent projects:
- `sukhdev-prod` (real users)
- `sukhdev-dev` (testing only)

Do not reuse keys between projects.

## 2) Apply Same SQL Migrations in Both

Apply migrations in order for both environments:
1. `supabase/sql/001_orders_secure_launch.sql`
2. `supabase/sql/002_auth_accounts_and_order_ownership.sql`
3. `supabase/sql/003_catalog_and_reviews.sql`
4. `supabase/sql/004_catalog_seed_data.sql`
5. `supabase/sql/005_testimonials.sql`
6. `supabase/sql/006_cart_items_and_review_purchase_gate.sql`
7. `supabase/sql/007_promo_codes.sql`
8. `supabase/sql/008_fix_rls_performance.sql`
9. `supabase/sql/009_fix_combo_pack_image_path.sql`
10. `supabase/sql/010_add_combo_pack_category_and_move_combo_product.sql`
11. `supabase/sql/011_feature_flags_social_experiment.sql`
12. `supabase/sql/012_payment_upi_accounts.sql`

Important:
- Keep object names identical.
- Never run test-only schema edits directly on prod.

## 3) Seed Strategy

- Dev: apply full seed content for fast testing.
- Prod: apply only approved data.
- If seed divergence is intentional, document it explicitly.

## 4) Auth URL and Redirect Setup

Production Supabase Auth settings:
- Site URL: `https://sukhdevialchemy.com`
- Redirect allowlist includes production URLs only.

Development Supabase Auth settings:
- Site URL: your dev URL.
- Redirect allowlist includes dev URLs only.

## 5) GitHub Environments and Secrets

Use GitHub Environments for secret isolation:

Environment `production`:
- `VITE_SUPABASE_URL` = prod project URL
- `VITE_SUPABASE_ANON_KEY` = prod anon key
- `VITE_AUTH_REDIRECT_URL` = production callback URL
- Optional: `VITE_CATALOG_CACHE_BUSTER`
- Optional: `VITE_DEV_MODE_ADMIN_EMAIL`

Environment `development`:
- `VITE_SUPABASE_URL` = dev project URL
- `VITE_SUPABASE_ANON_KEY` = dev anon key
- `VITE_AUTH_REDIRECT_URL` = dev callback URL
- Optional: `VITE_CATALOG_CACHE_BUSTER`
- Optional: `VITE_DEV_MODE_ADMIN_EMAIL`

Never copy production secrets into the development environment.

## 6) Branch to Environment Mapping

- `main` -> production deployment workflow
- `develop` -> development build workflow (artifact only)

Current workflows:
- `.github/workflows/deploy-pages.yml` (production)
- `.github/workflows/build-dev.yml` (development)

## 7) Parity Verification Queries (Run in Both DBs)

Check tables exist:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Check critical columns:

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
and table_name in ('orders', 'profiles', 'categories', 'products', 'product_reviews', 'testimonials', 'cart_items', 'promo_codes', 'feature_flags', 'payment_upi_accounts')
order by table_name, ordinal_position;
```

Check RLS enabled:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename in ('orders', 'profiles', 'product_reviews', 'cart_items')
order by tablename;
```

Check policy inventory:

```sql
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

## 8) Smoke Tests Per Environment

Run separately against dev and prod:
- Sign up and sign in
- Catalog loads with expected products
- Add/remove cart item
- Checkout and order creation
- Order visibility: customer sees own, admin sees all
- Review gate: paid purchase required

## 9) Change Control Rule

Before promoting DB-related changes:
1. Apply on dev
2. Smoke test on dev
3. Record migration notes
4. Apply on prod
5. Re-run verification queries

## 10) Pre-Razorpay Readiness

Before payment gateway rollout, confirm:
- `orders` write/update paths are working in both environments.
- Admin account exists in both environments.
- Webhook endpoints will target environment-specific backends.
