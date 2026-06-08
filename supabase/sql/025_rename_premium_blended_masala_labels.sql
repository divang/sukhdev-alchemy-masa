-- Normalize premium category and product display names.
-- Run this migration on existing databases to keep naming consistent.

update public.categories
set
  name = 'Premium Blended Masala',
  updated_at = now()
where id = 'premium-masala';

update public.products
set
  name = case id
    when 'bharwa-masala-premium' then 'Bharwa Masala Premium'
    when 'chat-masala-premium' then 'Chaat Masala Premium'
    when 'chhole-masala-premium' then 'Chole Masala Premium'
    when 'garam-masala-premium' then 'Mix Masala Premium Blend'
    else name
  end,
  updated_at = now()
where id in (
  'bharwa-masala-premium',
  'chat-masala-premium',
  'chhole-masala-premium',
  'garam-masala-premium'
);
