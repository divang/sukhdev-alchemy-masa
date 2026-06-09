-- Final V2 cleanup: remove legacy orders.items shadow and sync trigger/function.
-- Run only after V2-first write path and normalized reads are confirmed stable.

alter table public.orders
  alter column subtotal_amount set default 0,
  alter column shipping_amount set default 0,
  alter column discount_amount set default 0,
  alter column final_amount_paise set default 0,
  alter column pricing_model_version set default 2;

update public.orders
set
  subtotal_amount = coalesce(subtotal_amount, 0),
  shipping_amount = coalesce(shipping_amount, 0),
  discount_amount = coalesce(discount_amount, 0),
  final_amount_paise = coalesce(final_amount_paise, round(coalesce(total_amount, 0) * 100)::bigint),
  pricing_model_version = 2
where
  subtotal_amount is null
  or shipping_amount is null
  or discount_amount is null
  or final_amount_paise is null
  or pricing_model_version <> 2;

alter table public.orders
  alter column subtotal_amount set not null,
  alter column shipping_amount set not null,
  alter column discount_amount set not null,
  alter column final_amount_paise set not null,
  alter column pricing_model_version set not null;

drop trigger if exists orders_sync_order_items_from_legacy on public.orders;
drop trigger if exists a_orders_sync_order_items_from_legacy on public.orders;
drop function if exists public.sync_order_items_from_legacy_order();

alter table public.orders
  drop column if exists items;
