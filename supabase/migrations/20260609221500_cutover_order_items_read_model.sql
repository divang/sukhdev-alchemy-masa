-- Keep normalized order_items in sync for legacy order inserts and enable safe client reads.

alter table public.order_items enable row level security;

revoke all on table public.order_items from anon;
revoke all on table public.order_items from authenticated;
grant select on table public.order_items to authenticated;
grant all on table public.order_items to service_role;

drop policy if exists "order_items_owner_or_admin_select" on public.order_items;
create policy "order_items_owner_or_admin_select"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "order_items_service_all" on public.order_items;
create policy "order_items_service_all"
on public.order_items
for all
to service_role
using (true)
with check (true);

create or replace function public.sync_order_items_from_legacy_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  item_index integer := 0;
  item_count integer := 0;
  product_id_value text;
  product_sku_value text;
  product_name_value text;
  quantity_value integer;
  grams_value integer;
  unit_price_value numeric(10,2);
  line_subtotal_value numeric(12,2);
  shipping_allocated_value numeric(10,2);
begin
  if new.items is null or jsonb_typeof(new.items) <> 'array' then
    return new;
  end if;

  item_count := jsonb_array_length(new.items);

  delete from public.order_items
  where order_id = new.id
    and legacy_item_ordinal is not null;

  for item in
    select value
    from jsonb_array_elements(new.items) as value
  loop
    item_index := item_index + 1;
    product_id_value := nullif(item ->> 'productId', '');
    quantity_value := greatest(coalesce((item ->> 'quantity')::integer, 1), 1);
    grams_value := greatest(coalesce((item ->> 'grams')::integer, 50), 1);
    unit_price_value := coalesce((item ->> 'pricePerUnit')::numeric(10,2), 0);
    line_subtotal_value := round(unit_price_value * quantity_value, 2);
    shipping_allocated_value := case
      when item_count > 0 then round(coalesce(new.shipping_amount, 0) / item_count, 2)
      else 0
    end;

    select p.sku, p.name
    into product_sku_value, product_name_value
    from public.products p
    where p.id = product_id_value;

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
      legacy_item_ordinal,
      created_at,
      updated_at
    )
    values (
      new.id,
      product_id_value,
      product_sku_value,
      coalesce(nullif(item ->> 'productName', ''), product_name_value, 'Unknown Item'),
      grams_value,
      quantity_value,
      unit_price_value,
      line_subtotal_value,
      0,
      0,
      shipping_allocated_value,
      0,
      0,
      line_subtotal_value,
      item_index,
      coalesce(new.created_at, now()),
      coalesce(new.updated_at, now())
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists orders_sync_order_items_from_legacy on public.orders;
drop trigger if exists a_orders_sync_order_items_from_legacy on public.orders;
create trigger a_orders_sync_order_items_from_legacy
after insert or update of items, subtotal_amount, shipping_amount, discount_amount, total_amount, updated_at
on public.orders
for each row
execute function public.sync_order_items_from_legacy_order();

comment on function public.sync_order_items_from_legacy_order() is 'Keeps order_items synchronized for legacy order writes while the app cuts over to normalized reads.';