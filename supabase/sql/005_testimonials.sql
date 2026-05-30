-- Testimonials table and initial seed values.
-- Run after 003_catalog_and_reviews.sql.

create table if not exists public.testimonials (
  id text primary key,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  location text not null,
  testimonial_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists testimonials_is_active_idx on public.testimonials(is_active);

drop trigger if exists testimonials_touch_updated_at on public.testimonials;
create trigger testimonials_touch_updated_at
before update on public.testimonials
for each row
execute function public.touch_updated_at();

alter table public.testimonials enable row level security;

revoke all on table public.testimonials from anon;
revoke all on table public.testimonials from authenticated;
grant select on table public.testimonials to anon, authenticated;
grant insert, update, delete on table public.testimonials to authenticated;

drop policy if exists "testimonials_public_read" on public.testimonials;
create policy "testimonials_public_read"
on public.testimonials
for select
to public
using (is_active = true);

drop policy if exists "testimonials_admin_write" on public.testimonials;
create policy "testimonials_admin_write"
on public.testimonials
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.testimonials (
  id,
  customer_name,
  rating,
  comment,
  location,
  testimonial_date,
  is_active
)
values
  (
    'testimonial-aditi',
    'Aditi',
    5,
    'Sukhdevi Alchemy has truly transformed my cooking! The quality, aroma, and freshness of their spices are unmatched. Their Chat Masala adds the perfect tangy punch to snacks and salads, while the Chhole Masala helps me create rich, authentic North Indian flavors at home. The Garam Masala brings exceptional depth and warmth to my curries, and the Bharwa Masala has made stuffed vegetables a family favorite. Every dish I prepare now carries that authentic restaurant-style taste. I highly recommend Sukhdevi Alchemy to anyone who loves flavorful, high-quality spices.',
    'Bengaluru, Karnataka',
    '2026-01-25',
    true
  ),
  (
    'testimonial-subhash',
    'Subhash',
    5,
    'As a food lover, I may not know how to cook, but I definitely know good taste when I experience it. After trying dishes prepared with Sukhdevi Alchemy spices, I was genuinely impressed by the rich flavors and authentic aroma. The Chat Masala adds a perfect burst of tangy flavor to snacks and fruits, while the Chhole Masala delivers the classic North Indian taste that makes every plate irresistible. The Garam Masala enhances the depth and richness of curries, and the Bharwa Masala brings a unique and delicious flavor to stuffed vegetable dishes. Every meal tastes more flavorful and memorable. Sukhdevi Alchemy spices have truly elevated my dining experience.',
    'Lucknow, Uttar Pradesh',
    '2026-01-27',
    true
  ),
  (
    'testimonial-geetika',
    'Geetika',
    5,
    'Being a working professional and managing work-from-home responsibilities, I often look for ways to prepare delicious meals without spending hours in the kitchen. Sukhdevi Alchemy spices have been a game-changer for me. Their Chhole Masala, Garam Masala, Chat Masala, and Bharwa Masala help me create authentic, homemade flavors in a fraction of the time. Earlier, achieving that rich aroma and balanced taste required preparing and blending multiple spices. With Sukhdevi Alchemy, I can enjoy the same homemade taste and aroma effortlessly. The Chhole Masala gives my chhole the perfect Punjabi flavor, the Garam Masala adds warmth and depth to curries, the Chat Masala instantly enhances snacks and salads, and the Bharwa Masala makes stuffed vegetables incredibly flavorful. These masalas have helped me save valuable time while ensuring my family enjoys restaurant-quality dishes with the comfort and authenticity of home-cooked food.',
    'Delhi, NCR',
    '2026-01-29',
    true
  )
on conflict (id) do update
set
  customer_name = excluded.customer_name,
  rating = excluded.rating,
  comment = excluded.comment,
  location = excluded.location,
  testimonial_date = excluded.testimonial_date,
  is_active = excluded.is_active,
  updated_at = now();

comment on table public.testimonials is 'Public testimonials shown on storefront.';