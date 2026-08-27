-- Complete fix: add ALL missing columns to plans table
-- Run this SECOND in Supabase SQL Editor (after baseline + drop)

-- 1. Enable PostGIS (if not already)
create extension if not exists postgis;

-- 2. Add ALL missing columns that the app code expects
alter table public.plans
  add column if not exists campus text,
  add column if not exists location geography(point, 4326),
  add column if not exists expires_at timestamptz,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists starts_at timestamptz;

-- 3. Backfill data for existing rows
update public.plans
set 
  campus = coalesce(campus, 'BVCOE Dhankawadi'),
  starts_at = coalesce(starts_at, created_at, now()),
  expires_at = coalesce(expires_at, coalesce(starts_at, created_at, now()) + interval '6 hours'),
  is_active = coalesce(is_active, true)
where campus is null or starts_at is null or expires_at is null or is_active is null;

-- 4. Make columns not null after backfill
alter table public.plans
  alter column campus set not null,
  alter column starts_at set not null,
  alter column expires_at set not null,
  alter column is_active set not null;

-- 5. Spatial indexes
create index if not exists idx_plans_location on public.plans using gist (location);
create index if not exists idx_plans_campus_active_expires on public.plans (campus, is_active, expires_at desc);

-- 6. Spatial RPCs that the app calls (using baseline schema: user_id, profiles)

-- Fetch plans near me (single page)
create or replace function public.fetch_plans_near_me(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer default 50000,
  p_limit integer default 20,
  p_user_id uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  activity text,
  description text,
  category text,
  max_spots integer,
  current_spots integer,
  location_name text,
  distance_meters double precision,
  starts_at timestamptz,
  expires_at timestamptz,
  creator_name text,
  creator_avatar text,
  joined boolean,
  saved boolean
)
language plpgsql stable as $$
declare
  user_campus text;
  user_point geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
begin
  -- Get user's campus
  select campus into user_campus from public.profiles where id = p_user_id;
  
  return query
  select
    p.id,
    p.user_id,
    p.user_name,
    p.activity,
    p.activity as description,
    p.category,
    p.spots_total as max_spots,
    p.spots_left as current_spots,
    p.location_name,
    st_distance(p.location, user_point) as distance_meters,
    p.starts_at,
    p.expires_at,
    p.user_name as creator_name,
    null as creator_avatar,
    exists (select 1 from public.plan_joins pj where pj.plan_id = p.id and pj.user_id = p_user_id) as joined,
    exists (select 1 from public.saved_plans sp where sp.plan_id = p.id and sp.user_id = p_user_id) as saved
  from public.plans p
  where p.is_active
    and p.expires_at > now()
    and (user_campus is null or p.campus = user_campus)
    and st_dwithin(p.location, user_point, p_radius_meters)
  order by p.location <-> user_point
  limit p_limit;
end $$;

-- Fetch plans near me (paginated)
create or replace function public.fetch_plans_near_me_paginated(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer default 50000,
  p_limit integer default 20,
  p_offset integer default 0,
  p_user_id uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  activity text,
  description text,
  category text,
  max_spots integer,
  current_spots integer,
  location_name text,
  distance_meters double precision,
  starts_at timestamptz,
  expires_at timestamptz,
  creator_name text,
  creator_avatar text,
  joined boolean,
  saved boolean
)
language plpgsql stable as $$
declare
  user_campus text;
  user_point geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
begin
  select campus into user_campus from public.profiles where id = p_user_id;
  
  return query
  select
    p.id,
    p.user_id,
    p.user_name,
    p.activity,
    p.activity as description,
    p.category,
    p.spots_total as max_spots,
    p.spots_left as current_spots,
    p.location_name,
    st_distance(p.location, user_point) as distance_meters,
    p.starts_at,
    p.expires_at,
    p.user_name as creator_name,
    null as creator_avatar,
    exists (select 1 from public.plan_joins pj where pj.plan_id = p.id and pj.user_id = p_user_id) as joined,
    exists (select 1 from public.saved_plans sp where sp.plan_id = p.id and sp.user_id = p_user_id) as saved
  from public.plans p
  where p.is_active
    and p.expires_at > now()
    and (user_campus is null or p.campus = user_campus)
    and st_dwithin(p.location, user_point, p_radius_meters)
  order by p.location <-> user_point
  limit p_limit offset p_offset;
end $$;

-- Fetch plans in bounding box (for map view)
create or replace function public.fetch_plans_in_bbox(
  p_min_lat double precision,
  p_min_lng double precision,
  p_max_lat double precision,
  p_max_lng double precision,
  p_limit integer default 50,
  p_offset integer default 0,
  p_user_id uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  activity text,
  description text,
  category text,
  max_spots integer,
  current_spots integer,
  location_name text,
  lat double precision,
  lng double precision,
  starts_at timestamptz,
  expires_at timestamptz,
  creator_name text,
  creator_avatar text,
  joined boolean,
  saved boolean
)
language plpgsql stable as $$
declare
  user_campus text;
  bbox geometry := st_makeenvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326);
begin
  select campus into user_campus from public.profiles where id = p_user_id;
  
  return query
  select
    p.id,
    p.user_id,
    p.user_name,
    p.activity,
    p.activity as description,
    p.category,
    p.spots_total as max_spots,
    p.spots_left as current_spots,
    p.location_name,
    st_y(p.location::geometry) as lat,
    st_x(p.location::geometry) as lng,
    p.starts_at,
    p.expires_at,
    p.user_name as creator_name,
    null as creator_avatar,
    exists (select 1 from public.plan_joins pj where pj.plan_id = p.id and pj.user_id = p_user_id) as joined,
    exists (select 1 from public.saved_plans sp where sp.plan_id = p.id and sp.user_id = p_user_id) as saved
  from public.plans p
  where p.is_active
    and p.expires_at > now()
    and (user_campus is null or p.campus = user_campus)
    and p.location::geometry && bbox
  order by p.created_at desc
  limit p_limit offset p_offset;
end $$;

-- Grant execute permissions
grant execute on function public.fetch_plans_near_me to anon, authenticated;
grant execute on function public.fetch_plans_near_me_paginated to anon, authenticated;
grant execute on function public.fetch_plans_in_bbox to anon, authenticated;