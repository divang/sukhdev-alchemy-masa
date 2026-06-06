-- Delivery partner registry for switchable courier integrations.

create table if not exists public.delivery_partner_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  display_name text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  integration_mode text not null default 'pending',
  service_area text not null default 'pan_india',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.delivery_partner_accounts
  add constraint delivery_partner_accounts_provider_key_check
  check (provider_key in ('shiprocket', 'delhivery', 'nimbuspost', 'smartship'));

alter table public.delivery_partner_accounts
  add constraint delivery_partner_accounts_integration_mode_check
  check (integration_mode in ('active', 'pending', 'disabled'));

create index if not exists delivery_partner_accounts_enabled_idx on public.delivery_partner_accounts(enabled);
create index if not exists delivery_partner_accounts_priority_idx on public.delivery_partner_accounts(priority);

drop trigger if exists delivery_partner_accounts_touch_updated_at on public.delivery_partner_accounts;
create trigger delivery_partner_accounts_touch_updated_at
before update on public.delivery_partner_accounts
for each row
execute function public.touch_updated_at();

alter table public.delivery_partner_accounts enable row level security;

revoke all on table public.delivery_partner_accounts from anon;
revoke all on table public.delivery_partner_accounts from authenticated;

grant select on table public.delivery_partner_accounts to anon, authenticated;
grant insert, update, delete on table public.delivery_partner_accounts to authenticated;

drop policy if exists "delivery_partner_accounts_public_read" on public.delivery_partner_accounts;
create policy "delivery_partner_accounts_public_read"
on public.delivery_partner_accounts
for select
to public
using (true);

drop policy if exists "delivery_partner_accounts_admin_write" on public.delivery_partner_accounts;
create policy "delivery_partner_accounts_admin_write"
on public.delivery_partner_accounts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.delivery_partner_accounts (provider_key, display_name, enabled, priority, integration_mode, service_area, notes)
values
  ('shiprocket', 'Shiprocket', true, 1, 'pending', 'pan_india', 'Best first option for quick aggregator onboarding and pan-India courier access.'),
  ('delhivery', 'Delhivery One', true, 2, 'pending', 'pan_india', 'Direct-courier option with broad coverage once account activation completes.'),
  ('nimbuspost', 'NimbusPost', true, 3, 'pending', 'pan_india', 'Fallback aggregator if Shiprocket onboarding is delayed.'),
  ('smartship', 'Smartship', false, 4, 'pending', 'pan_india', 'Current reference partner; keep disabled while onboarding is pending.')
on conflict (provider_key) do update
set
  display_name = excluded.display_name,
  enabled = excluded.enabled,
  priority = excluded.priority,
  integration_mode = excluded.integration_mode,
  service_area = excluded.service_area,
  notes = excluded.notes,
  updated_at = now();