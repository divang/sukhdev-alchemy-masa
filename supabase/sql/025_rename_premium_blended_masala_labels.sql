-- Normalize premium category and product display names.
-- Run this migration on existing databases to keep naming consistent.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'categories'
      and column_name = 'updated_at'
  ) then
    update public.categories
    set
      name = 'Premium Blended Masala',
      updated_at = now()
    where id = 'premium-masala';
  else
    update public.categories
    set name = 'Premium Blended Masala'
    where id = 'premium-masala';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'updated_at'
  ) then
    update public.products
    set
      name = case id
        when 'bharwa-masala-premium' then 'Bharwa Masala Premium'
        when 'chat-masala-premium' then 'Chaat Masala Premium'
        when 'chhole-masala-premium' then 'Chole Masala Premium'
        when 'garam-masala-premium' then 'Mix Masala Premium Blend'
        else name
      end,
      updated_at = now()
    where id in (
      'bharwa-masala-premium',
      'chat-masala-premium',
      'chhole-masala-premium',
      'garam-masala-premium'
    );
  else
    update public.products
    set name = case id
      when 'bharwa-masala-premium' then 'Bharwa Masala Premium'
      when 'chat-masala-premium' then 'Chaat Masala Premium'
      when 'chhole-masala-premium' then 'Chole Masala Premium'
      when 'garam-masala-premium' then 'Mix Masala Premium Blend'
      else name
    end
    where id in (
      'bharwa-masala-premium',
      'chat-masala-premium',
      'chhole-masala-premium',
      'garam-masala-premium'
    );
  end if;
end
$$;
