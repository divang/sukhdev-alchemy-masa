-- Align Amazon image URLs and MRP/discount pattern for blended and tea masala products.
-- Run after 043_sync_amazon_masala_catalog.sql.

begin;

with product_updates(id, mrp_price, image_path, tags) as (
  values
    ('garam-masala-premium', 320::numeric, 'https://m.media-amazon.com/images/I/419FQ-lBADL._SY300_SX300_QL70_ML2_.jpg', array['premium','amazon-synced']::text[]),
    ('bharwa-masala-premium', 135::numeric, 'https://m.media-amazon.com/images/I/71m3+3eZaJL._SY550_.jpg', array['premium','amazon-synced']::text[]),
    ('chat-masala-premium', 150::numeric, 'https://m.media-amazon.com/images/I/71WhsD02NQL._SY550_.jpg', array['premium','amazon-synced']::text[]),
    ('chhole-masala-premium', 170::numeric, 'https://m.media-amazon.com/images/I/71gonnuiigL._SY550_.jpg', array['premium','amazon-synced']::text[]),
    ('garam-masala-crest', 200::numeric, 'https://m.media-amazon.com/images/I/719GEhJH7IL._SY550_.jpg', array['premium','amazon-synced']::text[]),
    ('ginger-tea-masala', 220::numeric, 'https://m.media-amazon.com/images/I/71mSOaIKpVL._SY550_.jpg', array['tea-masala','amazon-synced']::text[]),
    ('elaichi-tea-masala', 360::numeric, 'https://m.media-amazon.com/images/I/711S5TseR9L._SY550_.jpg', array['tea-masala','amazon-synced']::text[]),
    ('dal-chini-cinnamon-tea-masala', 260::numeric, 'https://m.media-amazon.com/images/I/71skjLsCs-L._SY550_.jpg', array['tea-masala','amazon-synced']::text[]),
    ('pav-bhaji-masala', 180::numeric, 'https://m.media-amazon.com/images/I/71SaayNd2zL._SY550_.jpg', array['premium','amazon-synced']::text[]),
    ('rajma-masala', 160::numeric, 'https://m.media-amazon.com/images/I/71A3Mi6D0DL._SY550_.jpg', array['premium','amazon-synced']::text[]),
    ('garam-masala-koppa', 200::numeric, 'https://m.media-amazon.com/images/I/711dvCdO7TL._SY550_.jpg', array['premium','amazon-synced']::text[]),
    ('sambhar-masala', 150::numeric, 'https://m.media-amazon.com/images/I/717iehYzyQL._SY550_.jpg', array['premium','amazon-synced']::text[]),
    ('peri-peri-masala', 170::numeric, 'https://m.media-amazon.com/images/I/71bXc46FZtL._SY550_.jpg', array['premium','amazon-synced']::text[])
)
update public.products p
set
  price_per_100g = coalesce((
    select round((p.price_per_100g / nullif(p.net_quantity_value, 0)) * p.net_quantity_value, 2)
  ), p.price_per_100g),
  image_path = u.image_path,
  tags = u.tags,
  bullet_highlights = array[
    replace(coalesce((p.bullet_highlights[1]), 'ASIN: N/A'), 'ASIN: ', 'ASIN: '),
    'Price (current): INR ' || trim(to_char(p.price_per_100g, 'FM999999990.00')),
    'MRP: INR ' || trim(to_char(u.mrp_price, 'FM999999990.00'))
  ],
  updated_at = now()
from product_updates u
where p.id = u.id;

-- Store MRP values in variant_data for UI/feeds that rely on this metadata.
update public.products p
set
  variant_data = array_remove(array[
    'Pack Size: ' || coalesce(p.net_quantity_value::text, '0') || coalesce(p.net_quantity_unit, ''),
    'MRP: INR ' || trim(to_char(u.mrp_price, 'FM999999990.00'))
  ], null),
  updated_at = now()
from (
  values
    ('garam-masala-premium', 320::numeric),
    ('bharwa-masala-premium', 135::numeric),
    ('chat-masala-premium', 150::numeric),
    ('chhole-masala-premium', 170::numeric),
    ('garam-masala-crest', 200::numeric),
    ('ginger-tea-masala', 220::numeric),
    ('elaichi-tea-masala', 360::numeric),
    ('dal-chini-cinnamon-tea-masala', 260::numeric),
    ('pav-bhaji-masala', 180::numeric),
    ('rajma-masala', 160::numeric),
    ('garam-masala-koppa', 200::numeric),
    ('sambhar-masala', 150::numeric),
    ('peri-peri-masala', 170::numeric)
) as u(id, mrp_price)
where p.id = u.id;

commit;
