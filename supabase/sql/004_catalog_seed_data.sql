-- Seed initial catalog data for categories and products.
-- Run after 003_catalog_and_reviews.sql.

insert into public.categories (id, name, slug, enabled, sort_order)
values
  ('premium-masala', 'Premium Masala', 'premium-masala', true, 1),
  ('raw-organic-spices', 'Raw Organic Spices', 'raw-organic-spices', false, 2)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  enabled = excluded.enabled,
  sort_order = excluded.sort_order;

insert into public.products (
  id,
  category_id,
  sku,
  name,
  description,
  price_per_100g,
  image_path,
  rating_avg,
  review_count,
  ingredients,
  tags,
  youtube_url,
  in_stock,
  is_active
)
values
  (
    'garam-masala-premium',
    'premium-masala',
    'PM-GARAM-001',
    'Mix Masala Premium Blend',
    'Made from the authentic family recipe. Our signature Mix Masala Premium Blend combines the finest aromatic spices to create a perfect balance of warmth and flavor.',
    350,
    'images/products/garam-masala-premium.png',
    4.8,
    5,
    array['Cumin Seeds','Coriander Seeds','Black Pepper','Cardamom','Cloves','Cinnamon','Bay Leaves','Nutmeg','Mace'],
    array['bestseller','premium','aromatic'],
    'https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi',
    true,
    true
  ),
  (
    'bharwa-masala-premium',
    'premium-masala',
    'PM-BHARWA-001',
    'Bharwa Masala Premium',
    'Specially crafted Bharwa Masala for stuffed vegetables. This premium blend brings authentic North Indian flavors with a perfect mix of tangy and spicy notes.',
    300,
    'images/products/bharwa-masala-premium.png',
    4.7,
    4,
    array['Coriander Powder','Cumin Powder','Dry Mango Powder','Red Chili Powder','Fennel Seeds','Black Salt','Rock Salt','Turmeric'],
    array['premium','stuffed-veggies','tangy'],
    'https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi',
    true,
    true
  ),
  (
    'chat-masala-premium',
    'premium-masala',
    'PM-CHAT-001',
    'Chat Masala Premium',
    'A tangy and zesty Chat Masala that transforms ordinary snacks into extraordinary treats. Perfect for fruits, salads, and street food favorites.',
    330,
    'images/products/chat-masala-premium.png',
    4.9,
    3,
    array['Black Salt','Cumin Powder','Dry Mango Powder','Black Pepper','Ginger Powder','Mint Leaves','Asafoetida','Citric Acid'],
    array['bestseller','premium','tangy','street-food'],
    'https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi',
    true,
    true
  ),
  (
    'chhole-masala-premium',
    'premium-masala',
    'PM-CHHOLE-001',
    'Chhole Masala Premium',
    'Authentic Chhole Masala that brings the taste of Punjab to your kitchen. Rich, aromatic, and perfectly balanced for the perfect chickpea curry.',
    330,
    'images/products/chhole-masala-premium.png',
    4.8,
    6,
    array['Coriander Seeds','Cumin Seeds','Dried Pomegranate Seeds','Black Cardamom','Cinnamon','Bay Leaves','Red Chili','Tea Leaves','Turmeric'],
    array['premium','punjabi','aromatic'],
    'https://youtu.be/pDOFN9OEKt4?si=RyDFBeFCk1LY0ZHi',
    true,
    true
  )
on conflict (id) do update
set
  category_id = excluded.category_id,
  sku = excluded.sku,
  name = excluded.name,
  description = excluded.description,
  price_per_100g = excluded.price_per_100g,
  image_path = excluded.image_path,
  rating_avg = excluded.rating_avg,
  review_count = excluded.review_count,
  ingredients = excluded.ingredients,
  tags = excluded.tags,
  youtube_url = excluded.youtube_url,
  in_stock = excluded.in_stock,
  is_active = excluded.is_active,
  updated_at = now();
