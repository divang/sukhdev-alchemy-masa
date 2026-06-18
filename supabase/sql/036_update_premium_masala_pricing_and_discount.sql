-- Update premium masala prices and enforce a 25% discount tag.

with pricing(id, new_price) as (
  values
    ('bharwa-masala-premium', 95),
    ('chat-masala-premium', 105),
    ('chhole-masala-premium', 120),
    ('garam-masala-premium', 160)
)
update public.products p
set
  price_per_100g = pricing.new_price,
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
from pricing
where p.id = pricing.id;
