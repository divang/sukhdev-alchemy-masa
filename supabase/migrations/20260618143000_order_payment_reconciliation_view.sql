-- Reconciliation helper view for comparing orders (rupees) vs gateway payments (paise).
-- orders.total_amount stores INR rupees; billing_payments.amount stores gateway minor units (paise for INR).

create or replace view public.order_payment_reconciliation as
select
  coalesce(o.id, bp.order_id) as order_id,
  o.user_id as order_user_id,
  bp.user_id as payment_user_id,
  o.created_at as order_created_at,
  bp.created_at as payment_created_at,
  o.total_amount as order_total_amount_rupees,
  bp.amount as payment_amount_minor,
  bp.currency as payment_currency,
  case
    when upper(coalesce(bp.currency, 'INR')) = 'INR' then round((bp.amount::numeric / 100.0), 2)
    else bp.amount::numeric
  end as payment_amount_rupees,
  o.payment_status as order_payment_status,
  bp.status as gateway_payment_status,
  bp.razorpay_order_id,
  bp.razorpay_payment_id,
  case
    when o.id is null then 'payment_without_order'
    when bp.order_id is null then 'order_without_payment'
    when upper(coalesce(bp.currency, 'INR')) = 'INR'
      and abs(coalesce(o.total_amount, 0)::numeric - round((coalesce(bp.amount, 0)::numeric / 100.0), 2)) > 0.01
      then 'amount_mismatch'
    else 'ok'
  end as reconciliation_status
from public.orders o
full outer join public.billing_payments bp
  on bp.order_id = o.id;

comment on view public.order_payment_reconciliation is
  'Compares orders.total_amount (INR rupees) with billing_payments.amount (gateway minor units, paise for INR).';
