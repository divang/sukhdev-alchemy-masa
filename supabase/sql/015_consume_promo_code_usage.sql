-- Atomically consume promo-code usage at checkout to prevent code reuse.

create or replace function public.consume_promo_code_usage(p_code text)
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
  v_promo public.promo_codes%rowtype;
  v_usage_count integer;
  v_usage_limit integer;
begin
  if auth.uid() is null then
    return query select false, 'Please sign in to use promo codes.', null::integer, null::integer;
    return;
  end if;

  v_normalized_code := upper(trim(coalesce(p_code, '')));
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

  update public.promo_codes as pc
  set
    usage_count = pc.usage_count + 1,
    updated_at = now()
  where pc.id = v_promo.id
    and (pc.usage_limit is null or pc.usage_count < pc.usage_limit)
  returning pc.usage_count, pc.usage_limit
  into v_usage_count, v_usage_limit;

  if not found then
    return query select false, 'This promo code has reached its usage limit.', null::integer, v_promo.usage_limit;
    return;
  end if;

  return query select true, null::text, v_usage_count, v_usage_limit;
end;
$$;

revoke all on function public.consume_promo_code_usage(text) from public;
grant execute on function public.consume_promo_code_usage(text) to authenticated;
grant execute on function public.consume_promo_code_usage(text) to service_role;
