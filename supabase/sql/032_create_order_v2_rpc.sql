-- Transactional V2-first order creation.
-- Inserts both public.orders and public.order_items in one DB transaction.

create or replace function public.create_order_v2(p_payload jsonb)
returns table (
  order_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_order_id text;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_customer_pincode text;
  v_items jsonb;
  v_subtotal_amount numeric(12,2);
  v_shipping_amount numeric(10,2);
  v_discount_amount numeric(10,2);
  v_promo_code text;
  v_total_amount numeric(12,2);
  v_status text;
  v_payment_status text;
  v_created_at timestamptz;
  v_updated_at timestamptz;
  v_item jsonb;
  v_item_index integer := 0;
  v_product_id text;
  v_product_name text;
  v_product_sku text;
  v_quantity integer;
  v_pack_grams integer;
  v_unit_price numeric(10,2);
  v_line_subtotal numeric(12,2);
  v_item_count integer := 0;
  v_shipping_allocated numeric(10,2);
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required to create an order.';
  end if;

  v_order_id := nullif(trim(coalesce(p_payload ->> 'id', '')), '');
  if v_order_id is null then
    raise exception 'Order id is required.';
  end if;

  v_customer_name := nullif(trim(coalesce(p_payload #>> '{customer,name}', '')), '');
  v_customer_email := nullif(trim(coalesce(p_payload #>> '{customer,email}', '')), '');
  v_customer_phone := nullif(trim(coalesce(p_payload #>> '{customer,phone}', '')), '');
  v_customer_address := nullif(trim(coalesce(p_payload #>> '{customer,address}', '')), '');
  v_customer_city := nullif(trim(coalesce(p_payload #>> '{customer,city}', '')), '');
  v_customer_pincode := nullif(trim(coalesce(p_payload #>> '{customer,pincode}', '')), '');
  v_items := coalesce(p_payload -> 'items', '[]'::jsonb);
  v_subtotal_amount := coalesce((p_payload ->> 'subtotalAmount')::numeric(12,2), 0);
  v_shipping_amount := coalesce((p_payload ->> 'shippingAmount')::numeric(10,2), 0);
  v_discount_amount := coalesce((p_payload ->> 'discountAmount')::numeric(10,2), 0);
  v_promo_code := nullif(trim(coalesce(p_payload ->> 'promoCode', '')), '');
  v_total_amount := coalesce((p_payload ->> 'totalAmount')::numeric(12,2), 0);
  v_status := coalesce(nullif(trim(coalesce(p_payload ->> 'status', '')), ''), 'pending');
  v_payment_status := coalesce(nullif(trim(coalesce(p_payload ->> 'paymentStatus', '')), ''), 'pending');
  v_created_at := coalesce((p_payload ->> 'createdAt')::timestamptz, now());
  v_updated_at := coalesce((p_payload ->> 'updatedAt')::timestamptz, v_created_at);

  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'Order items must be an array.';
  end if;

  select count(*) into v_item_count
  from jsonb_array_elements(v_items);

  if exists (select 1 from public.orders where id = v_order_id) then
    return query select v_order_id;
    return;
  end if;

  insert into public.orders (
    id,
    user_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    customer_city,
    customer_pincode,
    items,
    subtotal_amount,
    shipping_amount,
    discount_amount,
    promo_code,
    billing_currency,
    final_amount_paise,
    pricing_model_version,
    total_amount,
    status,
    payment_status,
    created_at,
    updated_at
  ) values (
    v_order_id,
    v_user_id,
    v_customer_name,
    v_customer_email,
    v_customer_phone,
    v_customer_address,
    v_customer_city,
    v_customer_pincode,
    v_items,
    v_subtotal_amount,
    v_shipping_amount,
    v_discount_amount,
    v_promo_code,
    'INR',
    round(v_total_amount * 100)::bigint,
    2,
    v_total_amount,
    v_status,
    v_payment_status,
    v_created_at,
    v_updated_at
  );

  for v_item in
    select value
    from jsonb_array_elements(v_items) as value
  loop
    v_item_index := v_item_index + 1;
    v_product_id := nullif(v_item ->> 'productId', '');
    v_product_name := coalesce(nullif(v_item ->> 'productName', ''), 'Unknown Item');
    v_quantity := greatest(coalesce((v_item ->> 'quantity')::integer, 1), 1);
    v_pack_grams := greatest(coalesce((v_item ->> 'grams')::integer, 50), 1);
    v_unit_price := coalesce((v_item ->> 'pricePerUnit')::numeric(10,2), 0);
    v_line_subtotal := round(v_unit_price * v_quantity, 2);
    v_shipping_allocated := case
      when v_item_count > 0 then round(v_shipping_amount / v_item_count, 2)
      else 0
    end;

    select p.sku, coalesce(nullif(v_item ->> 'productName', ''), p.name, v_product_name)
    into v_product_sku, v_product_name
    from public.products p
    where p.id = v_product_id;

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
    ) values (
      v_order_id,
      v_product_id,
      v_product_sku,
      v_product_name,
      v_pack_grams,
      v_quantity,
      v_unit_price,
      v_line_subtotal,
      0,
      0,
      v_shipping_allocated,
      0,
      0,
      v_line_subtotal,
      v_item_index,
      v_created_at,
      v_updated_at
    );
  end loop;

  return query select v_order_id;
end;
$$;

revoke all on function public.create_order_v2(jsonb) from public;
grant execute on function public.create_order_v2(jsonb) to authenticated;
grant execute on function public.create_order_v2(jsonb) to service_role;

comment on function public.create_order_v2(jsonb) is 'Creates an order and normalized order_items transactionally while preserving a legacy items shadow for compatibility.';