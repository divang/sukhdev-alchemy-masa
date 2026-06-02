-- Dynamic UPI account routing for payment fallback/switching.

create table if not exists public.payment_upi_accounts (
  id text primary key,
  display_name text not null,
  upi_id text not null unique,
  payee_name text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_upi_accounts_enabled_priority_idx
  on public.payment_upi_accounts(enabled, priority);

drop trigger if exists payment_upi_accounts_touch_updated_at on public.payment_upi_accounts;
create trigger payment_upi_accounts_touch_updated_at
before update on public.payment_upi_accounts
for each row
execute function public.touch_updated_at();

alter table public.payment_upi_accounts enable row level security;

revoke all on table public.payment_upi_accounts from anon;
revoke all on table public.payment_upi_accounts from authenticated;

grant select on table public.payment_upi_accounts to anon, authenticated;
grant insert, update, delete on table public.payment_upi_accounts to authenticated;

drop policy if exists "payment_upi_accounts_public_read" on public.payment_upi_accounts;
create policy "payment_upi_accounts_public_read"
on public.payment_upi_accounts
for select
to public
using (enabled = true);

drop policy if exists "payment_upi_accounts_admin_write" on public.payment_upi_accounts;
create policy "payment_upi_accounts_admin_write"
on public.payment_upi_accounts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.payment_upi_accounts (id, display_name, upi_id, payee_name, enabled, priority)
values
  ('primary', 'Primary UPI', 'poonam.om.107@okicici', 'Sukhdevi Alchemy', true, 1),
  ('backup-divang', 'Backup UPI', 'divang.s@okicici', 'Sukhdevi Alchemy', true, 2)
on conflict (id) do update
set
  display_name = excluded.display_name,
  upi_id = excluded.upi_id,
  payee_name = excluded.payee_name,
  enabled = excluded.enabled,
  priority = excluded.priority,
  updated_at = now();
