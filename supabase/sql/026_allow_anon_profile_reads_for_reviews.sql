-- Allow anonymous storefront reads of reviewer names from public.profiles.
-- Needed because catalog review hydration selects reviewer id/full_name before a user signs in.

revoke all on table public.profiles from anon;
grant select on public.profiles to anon;

drop policy if exists "profiles_public_select" on public.profiles;

create policy "profiles_public_select"
on public.profiles
for select
to anon
using (true);
