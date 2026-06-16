-- Backfill Amazon listing defaults for existing catalog rows.
-- This script only fills empty values and preserves any explicitly set product metadata.

update public.products p
set
  public_slug = coalesce(
    nullif(p.public_slug, ''),
    lower(regexp_replace(p.id, '[^a-zA-Z0-9]+', '-', 'g'))
  ),
  brand_name = coalesce(nullif(p.brand_name, ''), 'SukhDevi Alchemy Spices'),
  short_description = coalesce(
    nullif(p.short_description, ''),
    case
      when position('.' in p.description) > 0 then split_part(p.description, '.', 1) || '.'
      else p.description
    end
  ),
  gtin = coalesce(nullif(p.gtin, ''), '29EAGPS2390M1ZX'),
  model_number = coalesce(
    nullif(p.model_number, ''),
    'SDA-' || upper(regexp_replace(coalesce(nullif(p.sku, ''), p.id), '[^a-zA-Z0-9]+', '-', 'g'))
  ),
  mpn = coalesce(nullif(p.mpn, ''), nullif(p.sku, '')),
  net_quantity_value = coalesce(p.net_quantity_value, 50),
  net_quantity_unit = coalesce(nullif(p.net_quantity_unit, ''), 'g'),
  variant_data = case
    when coalesce(array_length(p.variant_data, 1), 0) > 0 then p.variant_data
    else array[
      'Pack Size: ' || coalesce(p.net_quantity_value, 50)::text || coalesce(nullif(p.net_quantity_unit, ''), 'g')
    ]
  end,
  material_info = coalesce(
    nullif(p.material_info, ''),
    case
      when p.category_id = 'raw-organic-spices' then 'Whole spice'
      when p.category_id = 'combo-pack-masala' then 'Combo pack of blended spice pouches'
      else 'Ground spice blend'
    end
  ),
  bullet_highlights = case
    when coalesce(array_length(p.bullet_highlights, 1), 0) > 0 then p.bullet_highlights
    when p.category_id = 'raw-organic-spices' then array[
      'Single-ingredient whole spice',
      'Net quantity: ' || coalesce(p.net_quantity_value, 50)::text || coalesce(nullif(p.net_quantity_unit, ''), 'g'),
      'Packed for freshness and daily kitchen use'
    ]
    else array[
      'Crafted in small batches for consistent aroma',
      'Net quantity: ' || coalesce(p.net_quantity_value, 50)::text || coalesce(nullif(p.net_quantity_unit, ''), 'g'),
      'Ingredient panel is clearly declared on this page'
    ]
  end,
  compliance_info = case
    when coalesce(array_length(p.compliance_info, 1), 0) > 0 then p.compliance_info
    else array[
      'FSSAI Lic. No.: 21226010003872',
      'GTIN/GSTIN: 29EAGPS2390M1ZX',
      'Store in a cool and dry place',
      'Keep away from moisture and direct sunlight',
      'Review ingredient and allergen suitability before consumption'
    ]
  end,
  category_breadcrumb = case
    when coalesce(array_length(p.category_breadcrumb, 1), 0) > 0 then p.category_breadcrumb
    else array['Home', 'Products', coalesce(c.name, p.category_id), p.name]
  end,
  additional_image_paths = coalesce(p.additional_image_paths, '{}'::text[])
from public.categories c
where c.id = p.category_id;

-- Fallback in case category row is missing.
update public.products p
set
  category_breadcrumb = case
    when coalesce(array_length(p.category_breadcrumb, 1), 0) > 0 then p.category_breadcrumb
    else array['Home', 'Products', p.category_id, p.name]
  end
where not exists (
  select 1
  from public.categories c
  where c.id = p.category_id
);
