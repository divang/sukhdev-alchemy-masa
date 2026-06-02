-- Fix combo pack image path for existing databases.

update public.products
set image_path = 'images/products/SDA-Combo-Pack.jpeg',
    updated_at = now()
where id = 'sukhdevi-combo-pack';
