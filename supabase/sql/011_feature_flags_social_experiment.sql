-- Feature flags for social experiment UI modules.

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feature_flags_enabled_idx on public.feature_flags(enabled);

drop trigger if exists feature_flags_touch_updated_at on public.feature_flags;
create trigger feature_flags_touch_updated_at
before update on public.feature_flags
for each row
execute function public.touch_updated_at();

alter table public.feature_flags enable row level security;

revoke all on table public.feature_flags from anon;
revoke all on table public.feature_flags from authenticated;

grant select on table public.feature_flags to anon, authenticated;
grant insert, update, delete on table public.feature_flags to authenticated;

drop policy if exists "feature_flags_public_read" on public.feature_flags;
create policy "feature_flags_public_read"
on public.feature_flags
for select
to public
using (true);

drop policy if exists "feature_flags_admin_write" on public.feature_flags;
create policy "feature_flags_admin_write"
on public.feature_flags
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.feature_flags (key, enabled, description)
values
  ('enable_social_experiment_section', false, 'Master switch for social experiment modules.'),
  ('enable_social_icons', false, 'Show social links in header and campaign section.'),
  ('enable_restaurant_to_home_reels', false, 'Show reel/video campaign cards.'),
  ('enable_chef_sample_cta', false, 'Show CTA for chef sample requests.')
on conflict (key) do update
set
  enabled = excluded.enabled,
  description = excluded.description,
  updated_at = now();
