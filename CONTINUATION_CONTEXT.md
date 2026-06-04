# Continuation Context

Last updated: 2026-06-04 UTC
Branch: main
Latest pushed commit: 1fb8dff
Previous major feature commit: d6ef491

## Why This File Exists
Use this as the single recovery document when chat/session history is unavailable.
It captures what is already shipped, what infrastructure is required, and what to verify first.

## Current Production Architecture
- Frontend: React + Vite app (GitHub Pages deployment).
- Backend: Supabase Auth + Postgres with RLS.
- Transactional auth email: Resend SMTP via Supabase Auth.
- Domain/DNS: Squarespace DNS -> GitHub Pages.

## Backend + Payment Integration (Merged Reference)

This section consolidates the implementation guidance previously split across backend and payment setup docs.

### Current vs Target
- Current checkout payment flow is client-confirmed (manual UPI deep-link + user confirmation).
- Target production payment flow must be server-verified (gateway order + signature verify + webhook reconciliation).

### Target System Shape
- Frontend: this React app.
- Backend: payment/order endpoints (Java microservices or equivalent) with secure gateway credentials.
- Database: Supabase/Postgres remains source of truth for order/payment business states.

### Required Backend API Contracts

Product API:
- `GET /api/products`
- `GET /api/products/{id}`
- `GET /api/products/category/{categoryId}`
- `GET /api/categories`

Order API:
- `POST /api/orders`
- `GET /api/orders/{id}`
- `GET /api/orders/user/{userId}`
- `PATCH /api/orders/{id}/status` (admin)

Payment API:
- `POST /api/payments/order` (create gateway order)
- `POST /api/payments/verify` (verify checkout callback signature)
- `POST /api/payments/webhook` (gateway event reconciliation; idempotent)
- Optional: `GET /api/payments/status/{orderId}`

Review API:
- `GET /api/reviews/product/{productId}`
- `POST /api/reviews`
- `GET /api/testimonials`

### Razorpay Production Requirements
- Create Razorpay live account and finish KYC.
- Generate:
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`
- Never expose `RAZORPAY_KEY_SECRET` or webhook secret to frontend.
- Frontend only receives publishable key id (`VITE_RAZORPAY_KEY_ID`).

### Backend Environment Variables (Server Only)
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `APP_BASE_URL`
- `FRONTEND_BASE_URL`

### Frontend Environment Variables (Public)
- `VITE_RAZORPAY_KEY_ID`
- `VITE_API_BASE_URL`

### Order Table Gateway Fields (Recommended)
Maintain business flags (`payment_status`, `status`) and store gateway audit references:
- `payment_gateway`
- `gateway_order_id`
- `gateway_payment_id`
- `gateway_signature`
- `payment_method`
- `payment_verified_at`
- `payment_gateway_status`
- `payment_payload` (jsonb)

### Payment State Rules (Critical)
- Browser must never be source of truth for paid status.
- Only backend verification/webhook can mark order paid.
- Verify signature (`order_id|payment_id`) before updates.
- Enforce idempotent webhook handling.
- Reject amount/order mismatch and duplicate fraud attempts.

### Frontend Refactor Needed for Phase 3
- Replace manual payment confirmation in `src/App.tsx` with gateway flow:
  1. Create app order (`pending`).
  2. Call backend `POST /api/payments/order`.
  3. Open Razorpay checkout.
  4. Send callback payload to backend `POST /api/payments/verify`.
  5. Update UI state only after backend confirms.
- Keep manual UPI flow only as optional fallback (`manual_upi`) and do not auto-mark paid.

### Payment Reconciliation Events
Handle at least:
- `payment.captured`
- `payment.failed`
- `order.paid`

### Go-Live Payment Checklist
1. Verify amount tampering is blocked server-side.
2. Verify signature mismatch is rejected.
3. Verify duplicate webhook delivery is idempotent.
4. Verify failed payment keeps order `pending`.
5. Verify captured payment updates once (`pending` -> `paid`, `pending` -> `processing`).
6. Verify admin can view gateway refs for support/reconciliation.

## Delivery Plan (Dev/Prod + Payments)
Execution order agreed for production hardening:

1. Phase 1: Dev/Prod segregation in codebase/runtime channeling.
2. Phase 2: Dev/Prod segregation in database (separate Supabase projects preferred).
3. Phase 3: Real Razorpay verification flow (server-verified, webhook-driven status updates).

### Phase 1 Status (Started)
- Added runtime mode gating with URL param support:
  - `?mode=dev` requests dev mode.
  - Effective dev mode is allowed only for configured admin identity (current intended admin email: `divang.s@gmail.com`).
  - Non-authorized users are forced to production mode.
- Added UI badges to indicate active mode in key headers.
- This is runtime channel segregation only; it does not yet switch to separate Supabase projects.

### Phase 2 Target
- Use two Supabase projects: `dev` and `prod`.
- Keep schema migration parity across both.
- Wire deploy pipelines so production deploy always points to prod Supabase secrets.

### Phase 2 Status (In Progress)
- Added workflow segregation in `.github/workflows`:
  - `deploy-pages.yml` (production publish) now runs with GitHub Environment `production`.
  - `build-dev.yml` (development channel) runs on `develop` and uses GitHub Environment `development`.
- Development workflow builds and uploads artifact only; it does **not** deploy to Pages, so production site remains untouched.
- This provides secret isolation for DB credentials between dev/prod channels.
- Added channel-state model for promo feature rollout (dev/prod + promote + rollback):
  - SQL migration: `supabase/sql/013_feature_channel_states.sql`
  - Admin controls: Promo Channel Controls card in `src/components/AdminPanel.tsx`
  - Checkout enforcement by channel in `src/components/CheckoutView.tsx`
- Added admin notifications for operational events:
  - SQL migration: `supabase/sql/014_admin_notifications.sql`
  - Auto notification records on new profile and new order inserts
  - Admin panel actions to send WhatsApp/email with user/order details
- Checkout promo UI is now disabled by default; enable with env `VITE_ENABLE_CHECKOUT_PROMO=true` when needed.

### Phase 2 Verification Checklist (Merged)
Run these checks in both `dev` and `prod` Supabase projects before any promotion:

1. Table parity:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

2. Critical column parity:

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
and table_name in ('orders', 'profiles', 'categories', 'products', 'product_reviews', 'testimonials', 'cart_items', 'promo_codes', 'feature_flags', 'payment_upi_accounts')
order by table_name, ordinal_position;
```

3. RLS status:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
and tablename in ('orders', 'profiles', 'product_reviews', 'cart_items')
order by tablename;
```

4. Policy inventory:

```sql
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

5. Change control:
   - Apply DB change on dev
   - Smoke test on dev
   - Record migration notes
   - Apply on prod
   - Re-run parity queries

### Phase 3 Target
- Implement verified payment with Razorpay through server-side functions:
  - create gateway order (server secret)
  - verify signature
  - webhook reconciliation (idempotent)
  - update order status in DB, then reflect in UI

## What Is Already Shipped (Important)

### Catalog + Product Model
- Product catalog is DB-backed with static fallback.
- Four primary 50g SKU products are configured:
  - Bharwa Masala: ₹125
  - Chaat Masala: ₹145
  - Chole Masala: ₹160
  - Mix Masala Premium Blend: ₹210
- Combo pack exists:
  - Sukhdevi Combo Pack (4 x 50g): ₹640

### Cart + Wishlist Persistence
- Signed-in cart items persist in Supabase (`cart_items`).
- Cart data can be used as wishlist intent data for outreach (email/WhatsApp workflows handled externally).

### Reviews
- Review submission requires login and paid purchase of the same product.
- Enforced in both:
  - client logic
  - DB policy/function (`has_purchased_product`)

### Checkout + Shipping
- Shipping is now pincode-based:
  - Karnataka pincodes (56/57/58/59): ₹60
  - Rest of India: ₹120
- Shipping is computed in checkout using entered pincode.

### Mobile UX Improvements
- Header actions compacted for small screens.
- Cart button/account actions now safer on narrow devices.
- Product details dialog uses viewport-safe heights and safe-area padding.
- Cart drawer bottom/actions adjusted for mobile safe-area.

### Brand Image Consistency
- Use a single shared logo asset across all pages: `/branding/logo-header-256.png`.
- Avoid mixing `/images/products/SDA-Logo.png` and `/branding/logo-header-256.png` so header, auth, payment, and tracking screens stay visually consistent.

### Contact Us
Professional contact section is live with:
- Instagram: https://www.instagram.com/sukhdevialchemy/
- Facebook: https://www.facebook.com/people/Sukhdevi-Alchemy/61590206949388/
- YouTube: https://www.youtube.com/@sukhdevialchemy
- WhatsApp: +91 78894 80171 (wa.me link)

### Product Image Asset Filenames (Merged)
If replacing product images, keep these filenames unless you also update `src/hooks/use-initial-data.ts` image paths:
- `garam-masala-premium.png`
- `bharwa-masala-premium.png`
- `chat-masala-premium.png`
- `chhole-masala-premium.png`

After replacing images:
- `npm run dev`
- `npm run build`
- `npm run preview`

## Files Added/Updated in Recent Sessions
- src/lib/pricing.ts
- src/lib/cart-persistence.ts
- src/lib/catalog.ts
- src/lib/auth.ts
- src/lib/runtime-mode.ts
- src/hooks/use-initial-data.ts
- src/App.tsx
- src/components/CartDrawer.tsx
- src/components/CheckoutView.tsx
- src/components/ProductDetailDialog.tsx
- src/components/ProductCard.tsx
- src/components/ContactUsSection.tsx
- supabase/sql/004_catalog_seed_data.sql
- supabase/sql/006_cart_items_and_review_purchase_gate.sql

## Supabase SQL Migration Order (Current)
Apply in this order:
1. supabase/sql/001_orders_secure_launch.sql
2. supabase/sql/002_auth_accounts_and_order_ownership.sql
3. supabase/sql/003_catalog_and_reviews.sql
4. supabase/sql/004_catalog_seed_data.sql
5. supabase/sql/005_testimonials.sql
6. supabase/sql/006_cart_items_and_review_purchase_gate.sql
7. supabase/sql/007_promo_codes.sql
8. supabase/sql/008_fix_rls_performance.sql
9. supabase/sql/009_fix_combo_pack_image_path.sql
10. supabase/sql/010_add_combo_pack_category_and_move_combo_product.sql
11. supabase/sql/011_feature_flags_social_experiment.sql
12. supabase/sql/012_payment_upi_accounts.sql
13. supabase/sql/013_feature_channel_states.sql
14. supabase/sql/014_admin_notifications.sql

## Environment Configuration

### Local .env
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_AUTH_REDIRECT_URL
- Optional: VITE_DEV_MODE_ADMIN_EMAIL (default in code is `divang.s@gmail.com`)
- Optional: VITE_ENABLE_CHECKOUT_PROMO (default disabled)
- Optional: VITE_ALLOW_CLIENT_ORDER_UPDATES (keep false for production unless explicitly required)

### GitHub Actions Secrets (Pages deploy)
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_AUTH_REDIRECT_URL

### GitHub Environments Required
- Environment: `production`
  - Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_REDIRECT_URL`, optional `VITE_CATALOG_CACHE_BUSTER`, optional `VITE_DEV_MODE_ADMIN_EMAIL`.
- Environment: `development`
  - Secrets: `VITE_SUPABASE_URL` (dev Supabase URL), `VITE_SUPABASE_ANON_KEY` (dev anon key), `VITE_AUTH_REDIRECT_URL` (dev callback URL), optional `VITE_CATALOG_CACHE_BUSTER`, optional `VITE_DEV_MODE_ADMIN_EMAIL`.
- Keep prod and dev values strictly separate.

### Supabase Auth URL Config
- Site URL must match deployed domain.
- Add both deployed URL and localhost URL to redirect allowlist.

## Auth / Login Blocker Notes

### Observed Behavior
- Users reported login/sign-up appearing stuck.
- Prior confirmed risk: Supabase auth rate limiting during bursts.

### What was improved in code
- Added explicit auth request timeouts.
- Added clearer timeout/rate-limit user-facing messages.
- Added debug instrumentation around sign-in/sign-up/profile fetch flow.

### Likely remaining external cause
- Supabase Auth rate limits and email provider constraints during pre-launch spikes.

### Required operational checks before launch
1. Supabase Dashboard -> Authentication -> Rate Limits.
2. Supabase logs for 429/too-many-requests patterns.
3. SMTP sender health in Resend (domain verified, sender stable).
4. Decide pre-launch sign-up strategy (controlled ramp vs open flood).

Note: exact per-hour/per-day quota values depend on Supabase plan/project settings and are not hardcoded in this repo.

## Admin / Customer Access Model
- `public.profiles.role` controls admin access.
- Customer sees own orders only.
- Admin can view all orders.
- Reviews require paid ownership of product.

Promote admin (after user exists):

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

## Quick Recovery Checklist (If Starting Fresh)
1. Clone repo and checkout `main`.
2. Configure `.env` with Supabase values.
3. Ensure all 001-006 SQL files are applied.
4. Run `npm install` then `npm run build`.
5. Smoke test:
   - Home loads catalog.
   - Product detail opens on mobile without clipping.
   - Add to cart works.
   - Checkout shipping changes by pincode.
   - Sign-up/sign-in works and surfaces errors quickly.
   - Review allowed only for paid purchased items.
   - Contact links open correctly.
6. Verify deploy secrets and push to `main` for Pages deploy.

## Deployment / Git Status Notes
- Latest pushed commit: `1fb8dff`.
- At time of last session, `package-lock.json` had a local modification not intentionally included in feature pushes.
- If release reproducibility is needed, inspect and decide whether to commit that lockfile change separately.

## Useful Verification Queries

Count users:

```sql
select count(*) as total_users from auth.users;
```

Confirmed vs unconfirmed:

```sql
select
  count(*) filter (where email_confirmed_at is not null) as confirmed_users,
  count(*) filter (where email_confirmed_at is null) as unconfirmed_users
from auth.users;
```

Recent profiles and roles:

```sql
select id, email, role, created_at
from public.profiles
order by created_at desc
limit 50;
```

Admins:

```sql
select id, email, role
from public.profiles
where role = 'admin';
```

Recent orders:

```sql
select id, user_id, customer_email, status, payment_status, total_amount, created_at
from public.orders
order by created_at desc
limit 50;
```
