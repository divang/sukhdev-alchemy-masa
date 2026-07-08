-- Add Garam Masala Crest and normalize premium masala pack size metadata to 70g.

with premium_mrp(id, mrp_price) as (
  values
    ('garam-masala-premium', 294::numeric),
    ('bharwa-masala-premium', 175::numeric),
    ('chat-masala-premium', 203::numeric),
    ('chhole-masala-premium', 224::numeric)
)
update public.products p
set
  price_per_100g = premium_mrp.mrp_price,
  net_quantity_value = 70,
  net_quantity_unit = 'g',
  tags = array_append(
    coalesce(
      array(
        select distinct t
        from unnest(coalesce(p.tags, '{}'::text[])) as t
        where t !~ '^discount-[0-9]{1,2}$'
      ),
      '{}'::text[]
    ),
    'discount-25'
  )
from premium_mrp
where p.id = premium_mrp.id;

insert into public.products (
  id,
  category_id,
  public_slug,
  sku,
  name,
  short_description,
  description,
  price_per_100g,
  image_path,
  rating_avg,
  review_count,
  ingredients,
  tags,
  net_quantity_value,
  net_quantity_unit,
  in_stock,
  is_active
)
values (
  'garam-masala-crest',
  'premium-masala',
  'garam-masala-crest',
  'PM-GMC-001',
  'Garam Masala Crest',
  'A bold and aromatic premium garam masala blend for curries, dals, and everyday Indian cooking.',
  'A bold and aromatic premium garam masala blend crafted for rich curries, dals, and everyday Indian cooking.',
  190,
  'images/products/garam-masala-premium.png',
  4.8,
  0,
  array[
    'Coriander',
    'Cumin',
    'Dry red chilli',
    'Somp',
    'Black pepper',
    'Cassia',
    'Bay Leaves',
    'Cloves',
    'Black Cardamom',
    'Star anise',
    'Ginger',
    'Shahi jeera',
    'Salt',
    'Green cardamom',
    'Mace',
    'Nutmeg'
  ],
  array['premium', 'aromatic'],
  70,
  'g',
  true,
  true
)
on conflict (id) do update
set
  category_id = excluded.category_id,
  public_slug = excluded.public_slug,
  sku = excluded.sku,
  name = excluded.name,
  short_description = excluded.short_description,
  description = excluded.description,
  price_per_100g = excluded.price_per_100g,
  image_path = excluded.image_path,
  rating_avg = excluded.rating_avg,
  review_count = excluded.review_count,
  ingredients = excluded.ingredients,
  tags = excluded.tags,
  net_quantity_value = excluded.net_quantity_value,
  net_quantity_unit = excluded.net_quantity_unit,
  in_stock = excluded.in_stock,
  is_active = excluded.is_active,
  updated_at = now();
