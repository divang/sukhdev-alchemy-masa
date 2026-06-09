-- Backfill V2 normalized commerce tables from legacy data.
-- Safe to run multiple times in the V2 database after 027_normalized_commerce_v2.sql.

insert into public.product_prices (
  product_id,
  quantity_basis,
  quantity_value,
  unit_price,
  currency,
  version,
  valid_from,
  reason
)
select
  p.id,
  'pack',
  coalesce(nullif(p.price_per_100g::integer, 0), 100),
  p.price_per_100g,
  'INR',
  1,
  coalesce(p.created_at, now()),
  'Initial V2 backfill from products.price_per_100g'
from public.products p
where not exists (
  select 1
  from public.product_prices pp
  where pp.product_id = p.id
    and pp.version = 1
);

insert into public.order_items (
  order_id,
  product_id,
  product_sku,
  product_name,
  pack_grams,
  quantity,
  unit_price,
  line_subtotal,
  discount_amount,
  discount_percent,
  shipping_allocated_amount,
  tax_percent,
  tax_amount,
  line_total,
  price_version_id,
  price_version_number,
  legacy_item_ordinal,
  created_at,
  updated_at
)
select
  o.id,
  product_ref.id,
  product_ref.sku,
  coalesce(item.value ->> 'productName', product_ref.name, 'Unknown Item'),
  greatest(coalesce((item.value ->> 'grams')::integer, product_ref_pack.pack_grams, 50), 1),
  greatest(coalesce((item.value ->> 'quantity')::integer, 1), 1),
  coalesce((item.value ->> 'pricePerUnit')::numeric(10,2), product_ref.price_per_100g, 0),
  coalesce((item.value ->> 'pricePerUnit')::numeric(10,2), product_ref.price_per_100g, 0) * greatest(coalesce((item.value ->> 'quantity')::integer, 1), 1),
  0,
  0,
  case
    when jsonb_array_length(o.items) > 0 then round(coalesce(o.shipping_amount, 0) / jsonb_array_length(o.items), 2)
    else 0
  end,
  0,
  0,
  coalesce((item.value ->> 'pricePerUnit')::numeric(10,2), product_ref.price_per_100g, 0) * greatest(coalesce((item.value ->> 'quantity')::integer, 1), 1),
  product_price.id,
  product_price.version,
  item.ordinality::integer,
  o.created_at,
  o.updated_at
from public.orders o
cross join lateral jsonb_array_elements(o.items) with ordinality as item(value, ordinality)
left join public.products product_ref
  on product_ref.id = item.value ->> 'productId'
left join lateral (
  select get_product_pack_grams.pack_grams
  from (
    select case
      when product_ref.id like 'raw-%' then 50
      else 50
    end as pack_grams
  ) as get_product_pack_grams
) as product_ref_pack on true
left join public.product_prices product_price
  on product_price.product_id = product_ref.id
 and product_price.version = 1
where not exists (
  select 1
  from public.order_items oi
  where oi.order_id = o.id
    and oi.legacy_item_ordinal = item.ordinality::integer
);

update public.orders o
set
  subtotal_amount = coalesce(agg.subtotal_amount, o.total_amount),
  shipping_amount = coalesce(o.shipping_amount, 0),
  discount_amount = coalesce(o.discount_amount, 0),
  final_amount_paise = coalesce(o.final_amount_paise, round(coalesce(o.total_amount, 0) * 100)::bigint),
  billing_currency = coalesce(nullif(o.billing_currency, ''), 'INR'),
  updated_at = now()
from (
  select
    oi.order_id,
    round(sum(oi.line_subtotal), 2) as subtotal_amount
  from public.order_items oi
  group by oi.order_id
) as agg
where agg.order_id = o.id
  and (
    o.subtotal_amount is null
    or o.final_amount_paise is null
    or o.billing_currency is null
  );

update public.billing_payments bp
set
  order_id = coalesce(
    bp.order_id,
    nullif(bp.raw #>> '{payload,payment,entity,notes,app_order_id}', ''),
    nullif(bp.raw #>> '{notes,app_order_id}', '')
  ),
  reconciled_at = case
    when bp.order_id is not null and bp.line_items_reconciled = true and bp.reconciled_at is null then now()
    else bp.reconciled_at
  end,
  updated_at = now()
where bp.order_id is null
   or (bp.line_items_reconciled = true and bp.reconciled_at is null);
