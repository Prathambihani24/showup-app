-- PostGIS Spatial Index Optimization for Showup
-- Target: Bharati Vidyapeeth Campus, Katraj, Dhankawadi, Pune
-- Purpose: High-concurrency spatial queries (bounding box + radius) for "plans near me"
-- Context: Fable-5 audit identified PostGIS bounding box bottleneck under concurrent load
-- Run: supabase db reset or apply via supabase db push

-- Enable PostGIS extension (required for geometry/geography types and spatial indexes)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Add PostGIS geography column to plans table for efficient spatial indexing
-- geography type uses WGS84 (lat/lng) and calculates distances in meters on spheroid
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- Backfill location column from existing latitude/longitude columns
-- BVCOE Dhankawadi campus center: 18.4592, 73.8567
UPDATE plans
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE location IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

-- Make location NOT NULL after backfill (new plans must have location)
-- ALTER TABLE plans ALTER COLUMN location SET NOT NULL; -- Run after verifying backfill

-- ============================================================================
-- SPATIAL INDEXES (GiST) - Core optimization for high-concurrency spatial queries
-- ============================================================================

-- Primary spatial index: GiST on geography column
-- GiST (Generalized Search Tree) is the standard index for PostGIS geography/geometry
-- Supports: ST_DWithin (radius), && (bounding box), ST_Distance, KNN (<->)
CREATE INDEX IF NOT EXISTS idx_plans_location_gist
ON plans USING GIST (location);

-- Composite index: campus + is_active + location (partial index for active campus plans)
-- This is the KEY index for "plans near me on my campus" query pattern
-- Partial index only indexes active plans per campus, reducing index size significantly
CREATE INDEX IF NOT EXISTS idx_plans_campus_active_location
ON plans USING GIST (location)
WHERE is_active = true;

-- Per-campus partial indexes for even better partition pruning
-- BVCOE Dhankawadi (primary campus per Fable-5 audit)
CREATE INDEX IF NOT EXISTS idx_plans_bvcoe_active_location
ON plans USING GIST (location)
WHERE is_active = true AND campus = 'BVCOE Dhankawadi';

-- Additional campuses (add as needed for multi-campus expansion)
-- CREATE INDEX IF NOT EXISTS idx_plans_bvcoe_pune_active_location
-- ON plans USING GIST (location)
-- WHERE is_active = true AND campus = 'BVCOE Pune';

-- ============================================================================
-- OPTIMIZED QUERY PATTERNS
-- ============================================================================

-- PATTERN 1: Radius search (ST_DWithin) - "plans within 2km of me"
-- Uses idx_plans_campus_active_location (partial GiST)
-- SELECT * FROM plans WHERE is_active = true AND campus = 'BVCOE Dhankawadi'
--   AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(73.8567, 18.4592), 4326)::geography, 2000)
--   ORDER BY location <-> ST_SetSRID(ST_MakePoint(73.8567, 18.4592), 4326)::geography
--   LIMIT 20;

-- PATTERN 2: Bounding box (&&) - "plans in map viewport"
-- Uses idx_plans_location_gist (or partial if campus filtered)
-- SELECT * FROM plans WHERE is_active = true AND campus = 'BVCOE Dhankawadi'
--   AND location && ST_MakeEnvelope(73.8, 18.4, 73.9, 18.5, 4326)::geography
--   ORDER BY created_at DESC LIMIT 50;

-- PATTERN 3: KNN (<->) - "closest 10 plans to me"
-- Uses partial GiST with <-> operator
-- SELECT * FROM plans WHERE is_active = true AND campus = 'BVCOE Dhankawadi'
--   ORDER BY location <-> ST_SetSRID(ST_MakePoint(73.8567, 18.4592), 4326)::geography
--   LIMIT 10;

-- PATTERN 4: Cursor-based pagination for infinite scroll
-- Use distance_m as cursor for consistent ordering
-- SELECT * FROM plans WHERE is_active = true AND campus = 'BVCOE Dhankawadi'
--   AND ST_DWithin(location, point, 5000)
--   AND distance_m > cursor_distance_m
--   ORDER BY location <-> point LIMIT 20;