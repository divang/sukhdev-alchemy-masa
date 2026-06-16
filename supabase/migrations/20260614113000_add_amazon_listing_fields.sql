-- Add Amazon listing-oriented attributes for dedicated public product URLs.

alter table public.products
  add column if not exists public_slug text,
  add column if not exists brand_name text,
  add column if not exists short_description text,
  add column if not exists bullet_highlights text[] not null default '{}',
  add column if not exists model_number text,
  add column if not exists mpn text,
  add column if not exists gtin text,
  add column if not exists variant_data text[] not null default '{}',
  add column if not exists net_quantity_value numeric(10,2),
  add column if not exists net_quantity_unit text,
  add column if not exists material_info text,
  add column if not exists compliance_info text[] not null default '{}',
  add column if not exists additional_image_paths text[] not null default '{}',
  add column if not exists category_breadcrumb text[] not null default '{}';

update public.products
set
  public_slug = coalesce(nullif(public_slug, ''), id),
  brand_name = coalesce(nullif(brand_name, ''), 'SukhDevi Alchemy Spices'),
  short_description = coalesce(nullif(short_description, ''), description),
  net_quantity_value = coalesce(net_quantity_value, 50),
  net_quantity_unit = coalesce(nullif(net_quantity_unit, ''), 'g')
where true;

create unique index if not exists products_public_slug_idx on public.products (lower(public_slug));

comment on column public.products.public_slug is 'Stable public-facing slug used for product URL pages.';
comment on column public.products.brand_name is 'Brand name shown on public listings and feed exports.';
comment on column public.products.short_description is 'Short summary suitable for marketplace listing body.';
comment on column public.products.bullet_highlights is 'Key feature bullet points for listing generators.';
comment on column public.products.model_number is 'Seller-defined model number field for catalog feeds.';
comment on column public.products.mpn is 'Manufacturer part number for listing feeds.';
comment on column public.products.gtin is 'GTIN/UPC/EAN value when available.';
comment on column public.products.variant_data is 'Variant attributes such as size/flavor/pack count.';
comment on column public.products.net_quantity_value is 'Net quantity numeric value.';
comment on column public.products.net_quantity_unit is 'Net quantity unit, for example g/ml.';
comment on column public.products.material_info is 'Material or product composition detail when relevant.';
comment on column public.products.compliance_info is 'Safety/compliance declarations.';
comment on column public.products.additional_image_paths is 'Additional image URLs/paths for listing galleries.';
comment on column public.products.category_breadcrumb is 'Category hierarchy used on public listing pages.';
