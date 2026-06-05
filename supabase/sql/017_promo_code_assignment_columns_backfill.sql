-- Backfill migration for environments where promo assignment columns were not yet applied.
-- Safe to run multiple times.

alter table public.promo_codes
  add column if not exists assigned_email text,
  add column if not exists assigned_phone text;

create index if not exists promo_codes_assigned_email_idx on public.promo_codes (assigned_email);
create index if not exists promo_codes_assigned_phone_idx on public.promo_codes (assigned_phone);
