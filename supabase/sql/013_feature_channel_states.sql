-- Channel-specific feature states with promote/rollback support.
-- Initial scope: promo code visibility by runtime channel (dev/prod).

create table if not exists public.feature_channel_states (
  key text primary key,
  dev_enabled boolean not null default false,
  prod_enabled boolean not null default true,
  previous_prod_enabled boolean,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  promoted_at timestamptz,
  promoted_by uuid
);

create index if not exists feature_channel_states_prod_enabled_idx
  on public.feature_channel_states (prod_enabled);

create index if not exists feature_channel_states_dev_enabled_idx
  on public.feature_channel_states (dev_enabled);

drop trigger if exists feature_channel_states_touch_updated_at on public.feature_channel_states;
create trigger feature_channel_states_touch_updated_at
before update on public.feature_channel_states
for each row
execute function public.touch_updated_at();

alter table public.feature_channel_states enable row level security;

revoke all on table public.feature_channel_states from anon;
revoke all on table public.feature_channel_states from authenticated;

grant select on table public.feature_channel_states to anon, authenticated;
grant insert, update, delete on table public.feature_channel_states to authenticated;

drop policy if exists "feature_channel_states_public_read" on public.feature_channel_states;
create policy "feature_channel_states_public_read"
on public.feature_channel_states
for select
to public
using (true);

drop policy if exists "feature_channel_states_admin_write" on public.feature_channel_states;
create policy "feature_channel_states_admin_write"
on public.feature_channel_states
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.feature_channel_states (
  key,
  dev_enabled,
  prod_enabled,
  previous_prod_enabled,
  promoted_at
)
values (
  'promo_codes',
  false,
  true,
  true,
  now()
)
on conflict (key) do nothing;
