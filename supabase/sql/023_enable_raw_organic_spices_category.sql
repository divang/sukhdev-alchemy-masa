-- Enable Raw Organic Spices category visibility for existing environments.

update public.categories
set enabled = true
where id = 'raw-organic-spices';
