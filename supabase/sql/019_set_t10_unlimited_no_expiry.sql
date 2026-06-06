-- Set promo code T10 to never expire and unlimited usage.
-- Apply in Supabase SQL Editor or via your DB deployment pipeline.

update public.promo_codes
set
  is_active = true,
  usage_limit = null,
  valid_from = null,
  valid_until = null,
  updated_at = now()
where upper(code) = 'T10';
