-- Reduce remaining legacy orders.items dependencies without dropping the column yet.
-- This keeps the app stable while moving DB logic to normalized order_items.

create or replace function public.has_purchased_product(target_product_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = auth.uid()
      and o.payment_status = 'paid'
      and oi.product_id = target_product_id
  );
$$;

create or replace function public.notify_admin_on_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_count integer;
  item_payload jsonb;
begin
  select
    count(*),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'productId', oi.product_id,
          'productName', oi.product_name,
          'quantity', oi.quantity,
          'grams', oi.pack_grams,
          'pricePerUnit', oi.unit_price
        )
        order by oi.legacy_item_ordinal nulls last, oi.id
      ),
      '[]'::jsonb
    )
  into item_count, item_payload
  from public.order_items oi
  where oi.order_id = new.id;

  insert into public.admin_notifications (event_type, title, message, payload)
  values (
    'new_order',
    'New order placed',
    format('Order %s placed by %s (%s)', new.id, new.customer_name, new.customer_email),
    jsonb_build_object(
      'orderId', new.id,
      'customerName', new.customer_name,
      'customerEmail', new.customer_email,
      'customerPhone', new.customer_phone,
      'totalAmount', new.total_amount,
      'paymentStatus', new.payment_status,
      'status', new.status,
      'itemCount', coalesce(item_count, 0),
      'items', coalesce(item_payload, '[]'::jsonb),
      'createdAt', coalesce(new.created_at, now())
    )
  );

  return new;
end;
$$;

comment on function public.has_purchased_product(text) is 'Returns true when the signed-in user has at least one paid order containing the requested product via normalized order_items.';
comment on function public.notify_admin_on_new_order() is 'Creates admin notifications for new orders using normalized order_items payload.';
