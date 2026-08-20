-- PostGIS RPC Functions for Showup Spatial Queries
-- Run via Supabase SQL Editor or: supabase db push
-- These functions encapsulate optimized spatial queries using GiST indexes
-- Migration 20260728000001_postgis_spatial_index.sql must be applied first

-- ============================================================================
-- FUNCTION 1: fetch_plans_near_me
-- Radius search + KNN ordering for "plans near me" home feed
-- Uses partial GiST index: idx_plans_bvcoe_active_location
-- ============================================================================
CREATE OR REPLACE FUNCTION fetch_plans_near_me(
  user_lat double precision,
  user_lng double precision,
  search_radius_m integer DEFAULT 5000,
  result_limit integer DEFAULT 20,
  campus_name text DEFAULT 'BVCOE Dhankawadi'
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_name text,
  activity text,
  location_name text,
  latitude double precision,
  longitude double precision,
  campus text,
  category text,
  time_label text,
  spots_total integer,
  spots_left integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  distance_m double precision
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT
    p.id,
    p.user_id,
    p.user_name,
    p.activity,
    p.location_name,
    p.latitude,
    p.longitude,
    p.campus,
    p.category,
    p.time_label,
    p.spots_total,
    p.spots_left,
    p.is_active,
    p.created_at,
    p.updated_at,
    ST_Distance(
      p.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) AS distance_m
  FROM plans p
  WHERE p.is_active = true
    AND p.campus = campus_name
    AND ST_DWithin(
      p.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      search_radius_m
    )
  ORDER BY p.location <-> ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
  LIMIT result_limit;
$$;

COMMENT ON FUNCTION fetch_plans_near_me IS
'Optimized radius + KNN query for "plans near me". Uses partial GiST index idx_plans_bvcoe_active_location. Expected <5ms p99 for 3000 active plans.';

-- ============================================================================
-- FUNCTION 2: fetch_plans_in_bbox
-- Bounding box query for map viewport (pan/zoom)
-- Uses full GiST index: idx_plans_location_gist (or partial with campus filter)
-- ============================================================================
CREATE OR REPLACE FUNCTION fetch_plans_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  result_limit integer DEFAULT 50,
  campus_name text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_name text,
  activity text,
  location_name text,
  latitude double precision,
  longitude double precision,
  campus text,
  category text,
  time_label text,
  spots_total integer,
  spots_left integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT
    p.id,
    p.user_id,
    p.user_name,
    p.activity,
    p.location_name,
    p.latitude,
    p.longitude,
    p.campus,
    p.category,
    p.time_label,
    p.spots_total,
    p.spots_left,
    p.is_active,
    p.created_at,
    p.updated_at
  FROM plans p
  WHERE p.is_active = true
    AND (campus_name IS NULL OR p.campus = campus_name)
    AND p.location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
  ORDER BY p.created_at DESC
  LIMIT result_limit;
$$;

COMMENT ON FUNCTION fetch_plans_in_bbox IS
'Bounding box query for map viewport. Uses GiST index idx_plans_location_gist (or partial if campus filtered).';

-- ============================================================================
-- FUNCTION 3: fetch_nearest_plans
-- Pure KNN: closest N plans to user location
-- Uses partial GiST index with <-> operator
-- ============================================================================
CREATE OR REPLACE FUNCTION fetch_nearest_plans(
  user_lat double precision,
  user_lng double precision,
  result_limit integer DEFAULT 10,
  campus_name text DEFAULT 'BVCOE Dhankawadi'
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_name text,
  activity text,
  location_name text,
  latitude double precision,
  longitude double precision,
  campus text,
  category text,
  time_label text,
  spots_total integer,
  spots_left integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  distance_m double precision
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT
    p.id,
    p.user_id,
    p.user_name,
    p.activity,
    p.location_name,
    p.latitude,
    p.longitude,
    p.campus,
    p.category,
    p.time_label,
    p.spots_total,
    p.spots_left,
    p.is_active,
    p.created_at,
    p.updated_at,
    ST_Distance(
      p.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) AS distance_m
  FROM plans p
  WHERE p.is_active = true
    AND p.campus = campus_name
  ORDER BY p.location <-> ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
  LIMIT result_limit;
$$;

COMMENT ON FUNCTION fetch_nearest_plans IS
'Pure KNN query for closest plans. Uses partial GiST index with <-> operator. No radius filter.';

-- ============================================================================
-- FUNCTION 4: fetch_plans_near_me_paginated
-- Cursor-based pagination for infinite scroll feed
-- Uses distance as cursor for consistent ordering
-- ============================================================================
CREATE OR REPLACE FUNCTION fetch_plans_near_me_paginated(
  user_lat double precision,
  user_lng double precision,
  search_radius_m integer DEFAULT 5000,
  result_limit integer DEFAULT 20,
  cursor_distance_m double precision DEFAULT NULL,
  campus_name text DEFAULT 'BVCOE Dhankawadi'
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_name text,
  activity text,
  location_name text,
  latitude double precision,
  longitude double precision,
  campus text,
  category text,
  time_label text,
  spots_total integer,
  spots_left integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  distance_m double precision
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT
    p.id,
    p.user_id,
    p.user_name,
    p.activity,
    p.location_name,
    p.latitude,
    p.longitude,
    p.campus,
    p.category,
    p.time_label,
    p.spots_total,
    p.spots_left,
    p.is_active,
    p.created_at,
    p.updated_at,
    ST_Distance(
      p.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) AS distance_m
  FROM plans p
  WHERE p.is_active = true
    AND p.campus = campus_name
    AND ST_DWithin(
      p.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      search_radius_m
    )
    AND (cursor_distance_m IS NULL OR 
         ST_Distance(
           p.location,
           ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
         ) > cursor_distance_m)
  ORDER BY p.location <-> ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
  LIMIT result_limit;
$$;

COMMENT ON FUNCTION fetch_plans_near_me_paginated IS