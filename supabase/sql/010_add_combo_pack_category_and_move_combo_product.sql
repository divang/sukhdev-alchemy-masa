-- Add dedicated combo category and move combo product into it for existing databases.

insert into public.categories (id, name, slug, enabled, sort_order)
values ('combo-pack-masala', 'Combo Pack Masala', 'combo-pack-masala', true, 2)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  enabled = excluded.enabled,
  sort_order = excluded.sort_order;

update public.categories
set sort_order = 3
where id = 'raw-organic-spices';

update public.products
set category_id = 'combo-pack-masala',
    updated_at = now()
where id = 'sukhdevi-combo-pack';
