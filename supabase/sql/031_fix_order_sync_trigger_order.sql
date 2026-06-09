-- Ensure legacy order_items sync trigger runs before admin notification trigger.

drop trigger if exists orders_sync_order_items_from_legacy on public.orders;
drop trigger if exists a_orders_sync_order_items_from_legacy on public.orders;

create trigger a_orders_sync_order_items_from_legacy
after insert or update of items, subtotal_amount, shipping_amount, discount_amount, total_amount, updated_at
on public.orders
for each row
execute function public.sync_order_items_from_legacy_order();
