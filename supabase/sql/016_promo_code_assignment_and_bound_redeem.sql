-- Add optional person-binding fields for promo codes and enforce them during redemption.

alter table public.promo_codes
  add column if not exists assigned_email text,
  add column if not exists assigned_phone text;

create index if not exists promo_codes_assigned_email_idx on public.promo_codes (assigned_email);
create index if not exists promo_codes_assigned_phone_idx on public.promo_codes (assigned_phone);

-- Replace previous single-arg function with a version that supports customer identity hints.
drop function if exists public.consume_promo_code_usage(text);

create or replace function public.consume_promo_code_usage(
  p_code text,
  p_customer_email text default null,
  p_customer_phone text default null
)
returns table (
  success boolean,
  error text,
  usage_count integer,
  usage_limit integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized_code text;
  v_normalized_input_email text;
  v_normalized_input_phone text;
  v_profile_email text;
  v_profile_phone text;
  v_promo public.promo_codes%rowtype;
  v_usage_count integer;
  v_usage_limit integer;
begin
  if auth.uid() is null then
    return query select false, 'Please sign in to use promo codes.', null::integer, null::integer;
    return;
  end if;

  v_normalized_code := upper(trim(coalesce(p_code, '')));
  v_normalized_input_email := lower(trim(coalesce(p_customer_email, '')));
  v_normalized_input_phone := regexp_replace(coalesce(p_customer_phone, ''), '\\D', '', 'g');

  if v_normalized_code = '' then
    return query select false, 'Please enter a promo code.', null::integer, null::integer;
    return;
  end if;

  select *
  into v_promo
  from public.promo_codes
  where code = v_normalized_code
    and is_active = true;

  if not found then
    return query select false, 'Invalid or inactive promo code.', null::integer, null::integer;
    return;
  end if;

  if v_promo.valid_from is not null and now() < v_promo.valid_from then
    return query select false, 'This promo code is not active yet.', null::integer, null::integer;
    return;
  end if;

  if v_promo.valid_until is not null and now() > v_promo.valid_until then
    return query select false, 'This promo code has expired.', null::integer, null::integer;
    return;
  end if;

  select
    lower(trim(coalesce(email, ''))),
    regexp_replace(coalesce(phone, ''), '\\D', '', 'g')
  into v_profile_email, v_profile_phone
  from public.profiles
  where id = auth.uid();

  if v_promo.assigned_email is not null then
    if lower(trim(v_promo.assigned_email)) <> coalesce(nullif(v_profile_email, ''), nullif(v_normalized_input_email, '')) then
      return query select false, 'This promo code is assigned to a different email.', null::integer, null::integer;
      return;
    end if;
  end if;

  if v_promo.assigned_phone is not null then
    if regexp_replace(v_promo.assigned_phone, '\\D', '', 'g') <> coalesce(nullif(v_profile_phone, ''), nullif(v_normalized_input_phone, '')) then
      return query select false, 'This promo code is assigned to a different phone number.', null::integer, null::integer;
      return;
    end if;
  end if;

  update public.promo_codes
  set
    usage_count = usage_count + 1,
    updated_at = now()
  where id = v_promo.id
    and (usage_limit is null or usage_count < usage_limit)
  returning promo_codes.usage_count, promo_codes.usage_limit
  into v_usage_count, v_usage_limit;

  if not found then
    return query select false, 'This promo code has reached its usage limit.', null::integer, v_promo.usage_limit;
    return;
  end if;

  return query select true, null::text, v_usage_count, v_usage_limit;
end;
$$;

revoke all on function public.consume_promo_code_usage(text, text, text) from public;
grant execute on function public.consume_promo_code_usage(text, text, text) to authenticated;
grant execute on function public.consume_promo_code_usage(text, text, text) to service_role;
