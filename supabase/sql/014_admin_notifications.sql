-- Admin notifications for operational follow-up.
-- Captures important events like new user signup and new order placement.

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('new_user', 'new_order')),
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  whatsapp_sent_at timestamptz,
  email_sent_at timestamptz
);

create index if not exists admin_notifications_created_at_idx
  on public.admin_notifications (created_at desc);

create index if not exists admin_notifications_event_type_idx
  on public.admin_notifications (event_type);

alter table public.admin_notifications enable row level security;

revoke all on table public.admin_notifications from anon;
revoke all on table public.admin_notifications from authenticated;
grant select, update on table public.admin_notifications to authenticated;

drop policy if exists "admin_notifications_admin_read" on public.admin_notifications;
create policy "admin_notifications_admin_read"
on public.admin_notifications
for select
to authenticated
using (public.is_admin());

drop policy if exists "admin_notifications_admin_update" on public.admin_notifications;
create policy "admin_notifications_admin_update"
on public.admin_notifications
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Trigger: create notification when a new profile row is created.
create or replace function public.notify_admin_on_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_notifications (event_type, title, message, payload)
  values (
    'new_user',
    'New user signup',
    format('New user created: %s (%s)', coalesce(new.full_name, 'Unknown'), coalesce(new.email, 'no-email')),
    jsonb_build_object(
      'profileId', new.id,
      'fullName', new.full_name,
      'email', new.email,
      'phone', new.phone,
      'createdAt', coalesce(new.created_at, now())
    )
  );

  return new;
end;
$$;

-- Trigger: create notification when a new order is created.
create or replace function public.notify_admin_on_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_count integer;
begin
  select coalesce(jsonb_array_length(new.items), 0) into item_count;

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
      'itemCount', item_count,
      'items', new.items,
      'createdAt', coalesce(new.created_at, now())
    )
  );

  return new;
end;
$$;

drop trigger if exists admin_notify_new_profile on public.profiles;
create trigger admin_notify_new_profile
after insert on public.profiles
for each row
execute function public.notify_admin_on_new_profile();

drop trigger if exists admin_notify_new_order on public.orders;
create trigger admin_notify_new_order
after insert on public.orders
for each row
execute function public.notify_admin_on_new_order();
