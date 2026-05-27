-- Replace incorrect image URLs with correct domain URLs.
-- Handles: http://89.44.86.30, https://rte-consult.ru (without order.)

-- Preview rows that will be updated.
select
  amo_lead_id,
  car_info->>'image_url' as car_image_url,
  manager_contact->>'avatar_url' as manager_avatar_url
from rte.orders
where (car_info->>'image_url') like 'http://89.44.86.30/%'
   or (car_info->>'image_url') like 'https://rte-consult.ru/%'
   or (manager_contact->>'avatar_url') like 'http://89.44.86.30/%'
   or (manager_contact->>'avatar_url') like 'https://rte-consult.ru/%';

-- Update car image URLs (IP address).
update rte.orders
set car_info = jsonb_set(
  car_info,
  '{image_url}',
  to_jsonb(replace(car_info->>'image_url', 'http://89.44.86.30', 'https://order.rte-consult.ru')),
  true
)
where (car_info->>'image_url') like 'http://89.44.86.30/%';

-- Update car image URLs (wrong domain without order.).
update rte.orders
set car_info = jsonb_set(
  car_info,
  '{image_url}',
  to_jsonb(replace(car_info->>'image_url', 'https://rte-consult.ru', 'https://order.rte-consult.ru')),
  true
)
where (car_info->>'image_url') like 'https://rte-consult.ru/%'
  and (car_info->>'image_url') not like 'https://order.rte-consult.ru/%';

-- Update manager avatar URLs (IP address).
update rte.orders
set manager_contact = jsonb_set(
  manager_contact,
  '{avatar_url}',
  to_jsonb(replace(manager_contact->>'avatar_url', 'http://89.44.86.30', 'https://order.rte-consult.ru')),
  true
)
where (manager_contact->>'avatar_url') like 'http://89.44.86.30/%';

-- Update manager avatar URLs (wrong domain without order.).
update rte.orders
set manager_contact = jsonb_set(
  manager_contact,
  '{avatar_url}',
  to_jsonb(replace(manager_contact->>'avatar_url', 'https://rte-consult.ru', 'https://order.rte-consult.ru')),
  true
)
where (manager_contact->>'avatar_url') like 'https://rte-consult.ru/%'
  and (manager_contact->>'avatar_url') not like 'https://order.rte-consult.ru/%';
