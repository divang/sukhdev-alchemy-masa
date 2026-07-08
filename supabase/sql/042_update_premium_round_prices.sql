-- Update premium masala selling prices to round figures.

with pricing(id, new_price) as (
  values
    ('garam-masala-premium', 225::numeric),
    ('bharwa-masala-premium', 135::numeric),
    ('chat-masala-premium', 150::numeric),
    ('chhole-masala-premium', 170::numeric)
)
update public.products p
set
  price_per_100g = pricing.new_price,
  updated_at = now()
from pricing
where p.id = pricing.id;
