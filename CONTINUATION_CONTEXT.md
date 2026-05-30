# Continuation Context

Last updated: 2026-05-30 19:52:34 UTC
Branch: main
Latest pushed commit: f562d89

## Current State Snapshot
- Supabase project used for testing: ndjztlhfhupvydozuski
- Supabase auth config is now loading in runtime:
  - hasUrl: true
  - hasAnonKey: true
  - isSupabaseConfigured: true
- Email confirmation flow is working end-to-end:
  - confirmation email received
  - confirmation link redirects to deployed GitHub URL

## What Happened In This Session
1. SMTP and confirmation flow was validated from CLI against live Supabase project.
2. Initial error observed for generated test address:
   - Error sending confirmation email
3. Confirmation flow passed with onboarding@resend.dev:
   - user created
   - no session returned
   - confirmation required behavior confirmed
4. Added resend confirmation feature in app.
5. Added deep debug logs in auth layer and UI layer.
6. User reported Create Account looked non-responsive.
7. Root cause identified:
   - toast calls existed, but no Toaster was mounted, so feedback was invisible.
8. Toaster mount fix applied and pushed.
9. Deployment issue diagnosed:
   - hosted build lacked VITE Supabase envs, causing auth not configured.
10. Deployment workflow updated to inject envs and fail fast when secrets are missing.

## Commits Already Pushed
1. c1200bb
   - Added email confirmation test script.
   - Restored sanitized .env.example.
2. 4e98353
   - Added resend confirmation flow and initial continuation file.
3. 4836ce1
   - Added detailed auth debug logs in auth service.
4. 5032066
   - Added visible auth UI logs and Supabase initialization logs.
5. cbe75fb
   - Mounted Sonner Toaster and refreshed continuation context.
6. bc8057b
   - Added Pages workflow env injection and documented deployment requirements.

## Environment Setup (Single Source)
### Local Development (.env)
Create local .env in repo root:

```bash
VITE_SUPABASE_URL=https://ndjztlhfhupvydozuski.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_AUTH_REDIRECT_URL=http://localhost:5000/
```

Notes:
- Do not commit .env.
- Restart npm run dev after changing .env.
- VITE_AUTH_REDIRECT_URL is recommended for predictable confirm-email redirects.

### Spark Deploy Environment Variables
Set in Spark project settings:

```bash
VITE_SUPABASE_URL=https://ndjztlhfhupvydozuski.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_AUTH_REDIRECT_URL=https://YOUR_SPARK_DOMAIN/
```

Then republish.

### GitHub Pages / Actions Secrets
Repository secrets required:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_AUTH_REDIRECT_URL (optional but recommended)

### Supabase URL Configuration
In Supabase Authentication -> URL Configuration:
- Site URL: deployed app URL
- Additional redirect URLs: deployed app URL + local URL

Examples:
- https://YOUR_SPARK_DOMAIN/
- http://localhost:5000/

## Auth Roles and Order Access (Single Source)
### Feature Summary
- Customer login: can see only their own orders.
- Admin login: can see all orders.

### Current Deployment Support Conditions
1. VITE Supabase envs configured in the deployed build.
2. SQL migrations applied:
   - supabase/sql/001_orders_secure_launch.sql
   - supabase/sql/002_auth_accounts_and_order_ownership.sql
3. Role rows exist in public.profiles.

### How User vs Admin Is Differentiated In DB
- Role is in public.profiles.role with values customer or admin.
- public.profiles.id references auth.users.id.
- public.orders.user_id references auth.users.id.

Policy behavior from migration:
- Customers can select only own orders.
- Admins can select all orders.
- Admins can update orders.

### Admin Payment/Status Update Discussion
Requirement: admin should update order status/payment (for example payment received).

Current behavior:
- Frontend has update helpers in src/lib/order-persistence.ts.
- Runtime flag VITE_ALLOW_CLIENT_ORDER_UPDATES controls client updates.
- If false: client updates intentionally blocked; use trusted backend/service role.
- If true: client attempts updates, still protected by RLS (admin-only update).

Production recommendation:
- Keep VITE_ALLOW_CLIENT_ORDER_UPDATES=false.
- Perform status/payment updates through backend/service-role endpoint.

## Catalog Migration Plan (Static Data -> DB)
Requirement discussed:
- Move homepage product catalog and related static content to Supabase DB.
- Include product display data, price, SKU, image path, rating/review data.
- Allow logged-in users to submit product reviews.

### Scope To Move From KV To DB
- categories
- products
- product reviews
- testimonials (optional in phase 2)
- image path references (store relative path or public URL)

### Proposed Tables
1. public.categories
   - id text primary key
   - name text not null
   - slug text unique not null
   - enabled boolean not null default true
   - sort_order int not null default 0
   - created_at timestamptz default now()

2. public.products
   - id text primary key
   - category_id text references public.categories(id)
   - sku text unique not null
   - name text not null
   - description text not null
   - price_per_100g numeric(10,2) not null
   - image_path text not null
   - youtube_url text null
   - in_stock boolean not null default true
   - tags text[] not null default '{}'
   - ingredients text[] not null default '{}'
   - is_active boolean not null default true
   - created_at timestamptz default now()
   - updated_at timestamptz default now()

3. public.product_reviews
   - id uuid primary key default gen_random_uuid()
   - product_id text not null references public.products(id) on delete cascade
   - user_id uuid not null references auth.users(id) on delete cascade
   - rating int not null check (rating between 1 and 5)
   - comment text not null
   - verified_purchase boolean not null default false
   - created_at timestamptz default now()
   - updated_at timestamptz default now()
   - unique(product_id, user_id)

4. public.product_rating_summary (view)
   - product_id
   - avg_rating
   - review_count

### RLS Design
- categories/products: public read (anon + authenticated), admin write.
- product_reviews:
  - everyone can read approved reviews
  - authenticated users can insert/update/delete only their own reviews
  - optional: restrict insert to verified purchasers (check orders.user_id + items JSON contains product_id)
- admin users can moderate/remove reviews.

### Frontend Refactor Plan
1. Add new data layer file (example: src/lib/catalog.ts) for DB fetches.
2. Replace useInitialData KV catalog bootstrap with Supabase reads.
3. Keep KV only as fallback/cache if DB is unavailable.
4. Replace Product.rating and Product.reviewCount with values from rating summary view.
5. Wire review submission UI for authenticated users only.

### Migration Strategy (Safe Rollout)
1. Add SQL migration file for new catalog/review tables.
2. Seed DB with current static data from useInitialData.
3. Release frontend reading from DB behind a feature flag.
4. Validate production data, then retire static KV bootstrap for products/reviews.

### Suggested New SQL Migration Files
- supabase/sql/003_catalog_and_reviews.sql
- supabase/sql/004_catalog_seed_data.sql

### Phase 1 Implementation Status (Completed)
- Added DB schema migration: supabase/sql/003_catalog_and_reviews.sql
- Added initial seed data migration: supabase/sql/004_catalog_seed_data.sql
- Added frontend DB catalog loader: src/lib/catalog.ts
- Updated startup hydration to prefer Supabase catalog with fallback to static seed: src/hooks/use-initial-data.ts
- Extended product type to include SKU support: src/lib/types.ts

### Activation Steps
1. Run SQL migration 003 in Supabase SQL Editor.
2. Run SQL migration 004 in Supabase SQL Editor.
3. Refresh/restart app.
4. Verify home page products load correctly and prices/images match expected values.

## Phase 2 Implementation Status (In Progress - Code Complete, Not Pushed Yet)
Implemented in working tree:
- DB-backed testimonials support with new SQL migration:
   - supabase/sql/005_testimonials.sql
- Catalog data layer enhancements:
   - load testimonials from DB in src/lib/catalog.ts
   - submit/update product review API in src/lib/catalog.ts
- App bootstrap now hydrates testimonials from DB snapshot in src/hooks/use-initial-data.ts
- Product review UI now allows logged-in users to submit/update reviews in src/components/ProductDetailDialog.tsx
- Product dialog receives current logged-in user in src/App.tsx
- Review type includes optional userId in src/lib/types.ts

### Phase 2 Activation Steps
1. Run SQL migration 005 in Supabase SQL Editor.
2. Refresh/restart app.
3. Validate testimonials are visible from DB data.
4. Sign in and submit a product review from Product Details -> Reviews tab.
5. Confirm row is added/updated in public.product_reviews.

### Phase 2 Notes
- product_reviews table enforces one review per user per product (upsert path used).
- Rating summary fields on products are refreshed by DB triggers from migration 003.
- Existing static fallback remains for resilience if DB read fails.

### Admin/User Behavior Alignment
- Admin login remains role-based via public.profiles.role = 'admin'.
- Customers see only own orders (already implemented).
- Admin sees all orders and can update order status/payment based on backend/RLS mode (already implemented).

### Promote Admin User
After signup and profile row exists:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

Sign out and sign in again afterward.

## Verification and SQL Snippets
### Quick App Verification
1. Confirm console log:

```text
[auth] supabase module initialized { hasUrl: true, hasAnonKey: true, isSupabaseConfigured: true }
```

2. Customer flow:
   - Sign in as customer and open tracking.
   - Only own orders should be visible.
3. Admin flow:
   - Sign in as admin and open admin/tracking.
   - All orders should be visible.
4. Updates:
   - Admin status/payment update should succeed (based on env mode + RLS).
   - Customer update should be blocked.

### Count users

```sql
select count(*) as total_users
from auth.users;
```

### Confirmed vs unconfirmed

```sql
select
  count(*) filter (where email_confirmed_at is not null) as confirmed_users,
  count(*) filter (where email_confirmed_at is null) as unconfirmed_users
from auth.users;
```

### Users + confirmation info

```sql
select id, email, email_confirmed_at, last_sign_in_at
from auth.users
order by created_at desc
limit 50;
```

### Profiles and roles

```sql
select id, email, role, created_at
from public.profiles
order by created_at desc
limit 50;
```

### Find admins

```sql
select id, email, role
from public.profiles
where role = 'admin';
```

### Orders ownership mapping

```sql
select id, user_id, customer_email, status, payment_status, created_at
from public.orders
order by created_at desc
limit 50;
```

### Re-run CLI confirmation test

```bash
SUPABASE_URL=https://ndjztlhfhupvydozuski.supabase.co \
SUPABASE_ANON_KEY=sb_publishable_... \
TEST_SIGNUP_EMAIL=you@example.com \
npm run test:email-confirmation
```

### Cleanup e2e test users

```sql
delete from auth.users
where email like 'smtp-e2e-%@example.com';
```

## Paste Into New Session

```text
Read CONTINUATION_CONTEXT.md first.
Then verify deployment env values for Supabase, validate signup + email confirmation flow,
and confirm customer-vs-admin order access with SQL checks.
If env values are missing, ask me for each key one by one.
```
