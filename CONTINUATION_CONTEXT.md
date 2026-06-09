# Continuation Context

Last updated: 2026-06-08 UTC
Branch: main
Latest pushed commit: eb307ed
Latest local commit: eb307ed
Previous major feature commit: 5c420f6

## Why This File Exists
Use this as the single recovery document when chat/session history is unavailable.
It captures what is already shipped, what infrastructure is required, and what to verify first.

## Current Production Architecture
- Frontend: React + Vite app (GitHub Pages deployment).
- Backend: Supabase Auth + Postgres with RLS.
- Transactional auth email: Resend SMTP via Supabase Auth.
- Domain/DNS: Squarespace DNS -> GitHub Pages.

## Apps Plan (Web + Android + iOS)

### Objective
- Keep one core product flow and one backend data model while delivering three clients:
  - Web app (existing production channel)
  - Android app
  - iOS app

### Target Architecture
- View Layer:
  - Web UI (React)
  - Android shell (Capacitor wrapping the same web build)
  - iOS shell (Capacitor wrapping the same web build)
- Business Logic Layer:
  - Shared TypeScript modules in `src/lib` (pricing, validation, auth guards, order rules, promo rules)
- Data/API Layer:
  - Supabase DB + RLS
  - Supabase Edge Functions for trusted operations (payment verify, notifications, shipping orchestration)

### Safety Rules (Do Not Break Web Production)
1. Keep web deployment pipeline unchanged.
2. Build mobile in separate branch (`mobile-capacitor`) until stable.
3. Use runtime platform checks for mobile-only behavior.
4. Keep mobile-specific features behind feature flags (default OFF in prod).
5. Never move critical payment/order state authority to client code.

### Delivery Phases
1. Phase A: Scaffold
  - Add Capacitor config and platform projects.
  - Verify no regression in web build and pages deploy.
2. Phase B: Android first
  - Create signed internal test build.
  - Run smoke tests for auth, cart, checkout, payment callback UX, order tracking.
3. Phase C: iOS onboarding
  - Prepare iOS project on macOS/Xcode.
  - Run TestFlight beta with same smoke suite.
4. Phase D: Store hardening
  - App icons, splash, deep-link config, privacy declarations, support URL, policy links.
5. Phase E: Controlled release
  - Staged rollout with monitoring and rollback playbook.

### E2E Consistency Checklist Across Web/Android/iOS
1. Sign-up/sign-in (email, Google, OTP where configured)
2. Cart persistence and restore
3. Checkout validation (India-only address constraints)
4. Payment verification state transitions (`pending` -> `paid` -> `processing`)
5. Promo validation parity
6. Order visibility rules (customer own orders, admin all orders)
7. Notification hooks and shipment orchestration logs

### Release Accounts and Cost Notes
- Google Play Console: one-time registration fee.
- Apple Developer Program: annual subscription (not monthly).

### Current Readiness
- Web is production-stable.
- Architecture already supports shared business/data layers.
- Next step: scaffold Capacitor with strict isolation so web release lane remains unaffected.

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
- Premium category label is now `Premium Blended Masala`.
- Four primary 50g SKU products are configured:
  - Bharwa Masala Premium: ₹125
  - Chaat Masala Premium: ₹145
  - Chole Masala Premium: ₹160
  - Mix Masala Premium Blend: ₹210
- Combo pack exists:
  - Sukhdevi Combo Pack (4 x 50g): ₹640
- Product cards now show a visible `50g` badge on product images.

### Cart + Wishlist Persistence
- Signed-in cart items persist in Supabase (`cart_items`).
- Cart data can be used as wishlist intent data for outreach (email/WhatsApp workflows handled externally).

### Reviews
- Review submission requires login and paid purchase of the same product.
- Enforced in both:
  - client logic
  - DB policy/function (`has_purchased_product`)
- Long reviews now show 3-4 lines first with `More` / `Show less` for better readability.

### Auth UX (Latest)
- Customer sign-in now supports Phone OTP flow.
- Phone provider has been enabled in Supabase Auth; SMS delivery still depends on the configured provider credentials and successful real-device testing.
- Google sign-in option is available (requires provider configuration in Supabase Auth).
- Google auth session persistence was hardened with explicit Supabase persisted session settings and retry/recovery logic around `getSession()` / auth-state changes.
- Email/password remains available as fallback.
- Forgot password and password reset update flow are implemented.
- Signup/profile provisioning now has DB audit logging + auth trigger profile auto-upsert.
- Email redirect hardening: non-production redirect values are ignored; production origin is used as fallback.
- Signed-in customers now have a dedicated account details screen showing profile data, role, preferences, and sign-out action.

### Checkout + Shipping
- Shipping is now pincode-based:
  - Karnataka pincodes (56/57/58/59): ₹60
  - Rest of India: ₹120
- Shipping is computed in checkout using entered pincode.
- Payment screen now shows a full amount breakdown: subtotal, shipping, promo discount, and final payable total.
- Promo validation/consumption now uses the checkout form email/phone values so person-bound promo codes are checked consistently at apply-time and place-order time.

### Mobile UX Improvements
- Header actions compacted for small screens.
- Mobile top header now uses a hamburger menu that opens the left category drawer, Amazon-style.
- Mobile top-right cart button was removed; cart remains available in the bottom mobile nav.
- Mobile header styling was refined to a white bar with green brand text for cleaner contrast.
- Admin users now get an admin shortcut inside the mobile category drawer.
- Product details dialog uses viewport-safe heights and safe-area padding.
- Cart drawer bottom/actions adjusted for mobile safe-area.
- Mobile My Orders visibility was improved for signed-in users.

### Brand Image Consistency
- Use a single shared logo asset across all pages: `/branding/logo-header-256.png`.
- Avoid mixing `/images/products/SDA-Logo.png` and `/branding/logo-header-256.png` so header, auth, payment, and tracking screens stay visually consistent.
- `index.html` favicon / apple-touch-icon now point to the shared branding logo image with cache-busting for more reliable tab icon behavior.

### Contact Us
Professional contact section is live with:
- Instagram: https://www.instagram.com/sukhdevialchemy/
- Facebook: https://www.facebook.com/sukhdevialchemy
- YouTube: https://www.youtube.com/@sukhdevialchemy
- WhatsApp: +91 78894 80171 (wa.me link)
- Legal/support contact email is now `care@sukhdevialchemy.com`.

### Orders + Admin UX
- Order tracking page was redesigned in a more Amazon-like layout.
- `Buy Again` item image click now adds the item back to cart.
- `Track package` opens the carrier tracking URL when available.
- Admin recent orders now expand on click to show full order details.
- Tracking visibility rules were tightened for the protected order flow introduced in recent sessions.

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
- src/lib/supabase.ts
- src/lib/promo-codes.ts
- src/lib/runtime-mode.ts
- src/hooks/use-initial-data.ts
- src/App.tsx
- src/components/AccountDetailsView.tsx
- src/components/AdminPanel.tsx
- src/components/CartDrawer.tsx
- src/components/CheckoutView.tsx
- src/components/OrderTrackingView.tsx
- src/components/ProductDetailDialog.tsx
- src/components/ProductCard.tsx
- src/components/CategorySidebar.tsx
- src/components/ContactUsSection.tsx
- src/components/AuthView.tsx
- src/components/TestimonialsSection.tsx
- public/privacy-policy.html
- public/returns-refunds-policy.html
- public/terms-and-conditions.html
- index.html
- supabase/sql/004_catalog_seed_data.sql
- supabase/sql/006_cart_items_and_review_purchase_gate.sql
- supabase/sql/018_auth_audit_logging_and_profile_trigger.sql
- supabase/sql/025_rename_premium_blended_masala_labels.sql

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
15. supabase/sql/015_consume_promo_code_usage.sql
16. supabase/sql/016_promo_code_assignment_and_bound_redeem.sql
17. supabase/sql/017_promo_code_assignment_columns_backfill.sql
18. supabase/sql/018_auth_audit_logging_and_profile_trigger.sql
19. supabase/sql/019_set_t10_unlimited_no_expiry.sql
20. supabase/sql/020_delivery_partner_accounts.sql
21. supabase/sql/021_shiprocket_feature_flag_and_order_shipments.sql
22. supabase/sql/022_shiprocket_webhook_enrichment.sql
23. supabase/sql/023_enable_raw_organic_spices_category.sql
24. supabase/sql/024_seed_raw_organic_spice_products.sql
25. supabase/sql/025_rename_premium_blended_masala_labels.sql
26. supabase/sql/026_allow_anon_profile_reads_for_reviews.sql

V2 additive migrations for isolated normalized-commerce rollout:
27. supabase/sql/027_normalized_commerce_v2.sql
28. supabase/sql/028_backfill_normalized_commerce_v2.sql
29. supabase/sql/029_cutover_order_items_read_model.sql
30. supabase/sql/030_reduce_legacy_order_json_dependencies.sql
31. supabase/sql/031_fix_order_sync_trigger_order.sql
32. supabase/sql/032_create_order_v2_rpc.sql
33. supabase/sql/033_drop_legacy_order_items_json.sql

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
- Added auth audit logging table + trigger profile provisioning from `auth.users`.
- Added specific message for Google provider-not-enabled errors.
- Added phone OTP and forgot/reset password user flows.

### Likely remaining external cause
- Supabase Auth rate limits and email provider constraints during pre-launch spikes.

### Required operational checks before launch
1. Supabase Dashboard -> Authentication -> Rate Limits.
2. Supabase logs for 429/too-many-requests patterns.
3. SMTP sender health in Resend (domain verified, sender stable).
4. Validate phone OTP delivery end-to-end on a real handset after SMS provider credentials are saved.
5. Decide pre-launch sign-up strategy (controlled ramp vs open flood).

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
3. Ensure all SQL migrations up to `018_auth_audit_logging_and_profile_trigger.sql` are applied in order.
4. Run `npm install` then `npm run build`.
5. Smoke test:
   - Home loads catalog.
   - Product detail opens on mobile without clipping.
   - Add to cart works.
   - Checkout shipping changes by pincode.
  - Promo code discount appears in both checkout and payment screens.
   - Sign-up/sign-in works and surfaces errors quickly.
  - Phone OTP sends and verifies on a real device.
  - Account button opens the profile details screen for signed-in users.
   - Review allowed only for paid purchased items.
   - Contact links open correctly.
6. Verify deploy secrets and push to `main` for Pages deploy.

## Deployment / Git Status Notes
- Latest pushed commit on `origin/main`: `eb307ed`.
- Working tree was clean at last check.
- GitHub Pages production source is `main:/docs`.
- Recent publish sequence included cleanup of stale hashed `docs/assets/index-*` files so Pages now contains only current referenced assets.

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

## DB Migration Go-Live Plan (V2 Cutover, Near Zero Downtime)

Last updated: 2026-06-09 UTC

### Objective
- Deliver normalized commerce schema (order items, pricing history, discount history, billing snapshots) without blank pages or visible errors.
- Keep availability at or above 99.9% during rollout.
- Use V2 app + V2 database as a fully isolated canary path before traffic cutover.

### Strategy Summary
- V1: existing app + existing DB (current production path).
- V2: new app deployment + new DB project (cloned data + new schema).
- Route by feature flag/runtime config with instant rollback to V1.
- Do not do in-place risky schema rewrites on V1 during customer browsing windows.

### Availability Model (What prevents blank pages)
1. Keep V1 untouched until V2 is validated.
2. V2 ships with backward-compatible reads and strong fallbacks:
  - If normalized tables are empty/unavailable, read legacy order JSON path.
  - Product rendering must always have safe fallback price and no-throw UI guard.
3. All schema additions are additive first; destructive actions delayed to post-stability window.
4. Use kill-switch env flags to disable new checkout path instantly.
5. Keep V1 and V2 deployment artifacts independently rollbackable.

### Preconditions Checklist
1. Create separate Supabase project for V2.
2. Copy secrets and auth providers for V2:
  - Supabase Auth settings
  - Resend sender/API
  - Razorpay webhook secret/key mapping for V2 endpoint
3. Confirm V2 environment variables in GitHub environment and runtime config.
4. Enable synthetic health checks for V2:
  - homepage load
  - product list fetch
  - checkout pricing compute
  - payment verify endpoint ping
5. Freeze non-critical releases during migration window.

### V2 Preflight Checklist
1. Confirm V2 Supabase project is separate from V1 production.
2. Current local Supabase link observed in this workspace: `ndjztlhfhupvydozuski`.
3. Treat `ndjztlhfhupvydozuski` as the existing V1/production project unless it is explicitly re-linked.
4. Do not apply V2 migrations 027/028 to `ndjztlhfhupvydozuski`.
5. Apply migrations through [supabase/sql/028_backfill_normalized_commerce_v2.sql](supabase/sql/028_backfill_normalized_commerce_v2.sql) on V2 only.
6. Verify required tables exist in V2:
  - orders
  - order_items
  - product_prices
  - product_discounts
  - billing_payments
  - access_entitlements
  - order_refunds
  - order_refund_items
7. Verify backfill counts:
  - every legacy order with items has at least one order_items row
  - every product has version 1 in product_prices
8. Verify order totals and payment mappings using the validation queries in this file.
9. Keep V1 traffic and webhook endpoints unchanged until V2 dark-launch testing passes.

### Step-by-Step Migration Plan

#### Phase A: Build V2 DB (No Traffic)
1. Provision V2 Supabase project.
2. Apply existing migrations in order through current latest.
3. Apply new additive migrations only (examples):
  - order_items
  - product_prices
  - product_discounts
  - billing snapshot columns
  - refunds tables
4. Backfill scripts on V2 only:
  - orders.items JSON -> order_items
  - products price -> product_prices version 1
  - current discount state -> product_discounts version 1
5. Run integrity checks:
  - row counts per key table
  - total reconciliation (sum(line totals) vs order totals)
  - null/constraint violations

#### Phase B: Deploy V2 App (Dark Launch)
1. Deploy V2 app build against V2 DB using separate environment.
2. Keep public traffic on V1.
3. Run manual E2E on V2:
  - browse -> cart -> checkout -> payment -> order tracking
  - email snapshot/export
  - admin panel operations
4. Run webhook and idempotency tests with V2 payment endpoint.

#### Phase C: Canary Traffic Shift
1. Start with internal/admin-only traffic (0-1%).
2. Expand to 5% if stable for 24h.
3. Expand to 25% if error budget is healthy.
4. Move to 100% after stable monitoring window.

Canary gates (must pass before next stage):
- frontend error rate not increased beyond baseline
- checkout success rate within baseline tolerance
- payment reconciliation variance = 0 critical cases
- no spike in support complaints/order mismatches

#### Phase D: Stabilization (Post Cutover)
1. Keep V1 read-only fallback window for at least 7 days.
2. Continue dual observability (V1 and V2 dashboards).
3. Only after stability, schedule legacy cleanup tasks.

### Rollback Plan (If Anything Goes Wrong)

Rollback triggers:
- checkout failures above threshold
- webhook failures/reconciliation mismatch
- blank page or major rendering regression
- auth/sign-in outage

Immediate rollback steps (target under 5 minutes):
1. Flip traffic route to V1 (runtime config / CDN rule / deployment alias).
2. Disable V2 checkout/payment flags.
3. Pause V2 webhook consumer if duplicate handling risk appears.
4. Announce incident status and keep V1 serving traffic.

Data safety during rollback:
1. Keep V2 writes; do not delete data during incident.
2. Export delta orders from V2 created after cutover start.
3. Reconcile payment records before any replays.
4. Decide replay strategy after root cause analysis.

### Recommended Deployment Pattern for This Repo
1. Maintain two deploy channels:
  - V1: current Pages channel (stable)
  - V2: separate preview/custom subdomain channel
2. Keep two Supabase projects and two secret sets.
3. Add runtime "db_channel" setting in `runtime.config.json` to force V1/V2.
4. Route only selected users to V2 (admin email or allow-list) before broad cutover.

### SQL Migration Safety Rules
1. Expand and contract method:
  - Expand: add tables/columns/indexes
  - Migrate: dual write/backfill/validate
  - Contract: remove old columns only after verification window
2. Never drop `orders.items` until all readers are switched and validated.
3. Use idempotent migrations (`if exists` / `if not exists`) when possible.
4. Run heavy backfills off-peak and in batches.

### Concrete Validation Queries Before Cutover

1. Orders without order_items after backfill:

```sql
select o.id
from public.orders o
left join public.order_items oi on oi.order_id = o.id
group by o.id
having count(oi.*) = 0;
```

2. Amount mismatch check:

```sql
select
  o.id,
  o.total_amount,
  round(coalesce(sum(oi.final_price), 0), 2) as items_total
from public.orders o
left join public.order_items oi on oi.order_id = o.id
group by o.id, o.total_amount
having abs(o.total_amount - round(coalesce(sum(oi.final_price), 0), 2)) > 0.01;
```

3. Active discount determinism check:

```sql
select product_id, count(*)
from public.product_discounts
where active_from <= now()
  and (expires_at is null or expires_at > now())
group by product_id
having count(*) > 5;
```

### Final Cutover Checklist
1. V2 E2E passed (manual and scripted smoke checks).
2. Payment gateway + webhook verified in V2.
3. Admin CSV/snapshot verified in V2.
4. Canary stages passed with monitored SLOs.
5. Rollback command and owner confirmed before 100% cutover.
6. Post-cutover 24h watch active.

### Cleanup Plan (After Stability)
1. Freeze V1 writes and take final backup.
2. Archive V1 DB snapshot.
3. Remove legacy read paths from app code.
4. Drop deprecated columns/tables in a separate maintenance release.
5. Keep rollback artifact for one additional release cycle.

## V2 Cutover Status

Last updated: 2026-06-09 UTC

Applied on linked project `ndjztlhfhupvydozuski`:
- 20260609211000_normalized_commerce_v2.sql
- 20260609211100_backfill_normalized_commerce_v2.sql
- 20260609221500_cutover_order_items_read_model.sql
- 20260609223000_reduce_legacy_order_json_dependencies.sql
- 20260609224500_fix_order_sync_trigger_order.sql
- 20260609230000_create_order_v2_rpc.sql
- 20260609233000_drop_legacy_order_items_json.sql

Current read model status:
- Client order reads use `public.order_items` as the source of truth.
- Review purchase verification uses normalized `order_items`.
- Admin CSV export and daily snapshot use normalized line items.
- Payment verification, Razorpay webhook shipment creation, admin shipment creation, and order notifications use normalized line items.

Current write model status:
- New order creation calls `public.create_order_v2(jsonb)` from the client persistence layer.
- `create_order_v2` writes both `orders` and `order_items` transactionally.
- `orders.items` is no longer part of the live schema.

Legacy footprint status:
- Legacy sync trigger/function for `orders.items` has been removed.
- `orders.items` has been dropped from the live database.
- Remaining V1 footprint is now limited to historical migration files kept for repository history.

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
