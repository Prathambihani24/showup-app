# Showup PostGIS Spatial Index Optimization

**Target:** Bharati Vidyapeeth Campus (BVCOE Dhankawadi, Katraj, Pune)  
**Context:** Fable-5 audit identified high-concurrency PostGIS bounding box bottleneck  
**Solution:** GiST indexes + RPC functions for <5ms p99 spatial queries at 3000+ concurrent users

---

## Files Created

### 1. Migration: `supabase/migrations/20260728000001_postgis_spatial_index.sql`
- Enables PostGIS extension
- Adds `geography(POINT, 4326)` column to `plans` table
- Backfills from existing `latitude`/`longitude` columns
- Creates **partial GiST indexes** for campus-specific active plans:
  - `idx_plans_bvcoe_active_location` — Primary index for BVCOE "plans near me"
  - `idx_plans_campus_active_location` — Generic campus partial index
  - `idx_plans_location_gist` — Full index for map viewport queries

### 2. RPC Functions: `supabase/migrations/20260728000002_postgis_rpc_functions.sql`
- `fetch_plans_near_me()` — Radius + KNN ordering (home feed)
- `fetch_plans_in_bbox()` — Bounding box for map viewport
- `fetch_nearest_plans()` — Pure KNN for "closest N"
- `fetch_plans_near_me_paginated()` — Cursor-based infinite scroll

### 3. Client Library: `lib/spatial-queries.js`
- TypeScript-friendly wrappers for all RPC functions
- Fallback to legacy client-side Haversine if RPC unavailable
- Distance formatting utilities

### 4. Updated Screens
- `screens/HomeScreen.js` — Uses `fetchPlansNearMe()` with legacy fallback
- `screens/CreatePlanScreen.js` — Inserts `location` geography column on plan creation

---

## Deployment Steps

### 1. Apply Migrations (Supabase Dashboard → SQL Editor)

```sql
-- Run migration 1 first: spatial indexes
-- Copy contents of supabase/migrations/20260728000001_postgis_spatial_index.sql

-- Then run migration 2: RPC functions
-- Copy contents of supabase/migrations/20260728000002_postgis_rpc_functions.sql
```

Or via CLI:
```bash
supabase db push
# or
supabase migration up
```

### 2. Verify Indexes Created
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'plans' AND indexname LIKE '%location%';
```

Expected:
- `idx_plans_location_gist` (full GiST)
- `idx_plans_campus_active_location` (partial: is_active=true)
- `idx_plans_bvcoe_active_location` (partial: is_active=true AND campus='BVCOE Dhankawadi')

### 3. Verify RPC Functions
```sql
SELECT proname FROM pg_proc WHERE proname LIKE 'fetch_plans%';
```

Expected:
- `fetch_plans_near_me`
- `fetch_plans_in_bbox`
- `fetch_nearest_plans`
- `fetch_plans_near_me_paginated`

### 4. Test Query Plans
```sql
EXPLAIN ANALYZE
SELECT * FROM fetch_plans_near_me(18.4592, 73.8567, 5000, 20, 'BVCOE Dhankawadi');
```

Should show: `Index Scan using idx_plans_bvcoe_active_location` with `<->` KNN ordering

---

## Query Patterns & Index Mapping

| Query Pattern | Function | Index Used | Use Case |
|---|---|---|---|
| Radius + KNN | `fetch_plans_near_me` | `idx_plans_bvcoe_active_location` | Home feed "plans near me" |
| Bounding box | `fetch_plans_in_bbox` | `idx_plans_location_gist` (or partial) | Map pan/zoom viewport |
| Pure KNN | `fetch_nearest_plans` | `idx_plans_bvcoe_active_location` | "Closest 10 plans" |
| Paginated feed | `fetch_plans_near_me_paginated` | `idx_plans_bvcoe_active_location` | Infinite scroll |

---

## Performance Targets (BVCOE Campus Load)

| Metric | Target | Fable-5 Context |
|---|---|---|
| p50 latency | <2ms | 3000 concurrent students at lunch peak |
| p99 latency | <5ms | PostGIS GiST handles high read concurrency |
| Index size | ~600KB | 3000 active plans × 200 bytes/index entry |
| Throughput | 10k+ qps | pgBouncer transaction pooling recommended |

---

## Index Strategy Rationale

### Why Partial GiST Indexes?
```sql
-- Only 10-20% of plans are active at any time
-- Campus filter reduces index size by 5-10x
CREATE INDEX idx_plans_bvcoe_active_location
ON plans USING GIST (location)
WHERE is_active = true AND campus = 'BVCOE Dhankawadi';
```

Benefits:
- **Smaller index** = more pages fit in shared_buffers = faster scans
- **No dead tuple bloat** from inactive plans
- **Partition pruning** — query planner skips irrelevant campuses entirely

### Why Geography over Geometry?
- `geography(POINT, 4326)` uses WGS84 spheroid
- `ST_Distance` returns **meters** (not degrees)
- `ST_DWithin` radius in **meters** — intuitive for "2km radius"
- KNN `<->` operator works natively on geography

---

## Client-Side Integration

### HomeScreen.js (fetchPlans)
```javascript
import { fetchPlansNearMe, formatDistance, BVCOE_CAMPUS } from '../lib/spatial-queries';

const { data, error } = await fetchPlansNearMe({
  lat: userLat,
  lng: userLng,
  radiusMeters: 5000,
  limit: 20,
  campus: 'BVCOE Dhankawadi',
});

// PostGIS returns distance_m in METERS
plan.distance = formatDistance(plan.distance_m / 1000); // "1.2 km" or "350 m"
```

### CreatePlanScreen.js (insert)
```javascript
await supabase.from('plans').insert({
  // ... existing fields
  latitude: lat,
  longitude: lng,
  location: `POINT(${lng} ${lat})`,  // PostGIS geography WKT
  campus: userCampus,
});
```

---

## Monitoring & Maintenance

### Index Size Check
```sql
SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass))
FROM pg_indexes WHERE tablename = 'plans' AND indexname LIKE '%location%';
```

### Query Performance
```sql
-- Monitor slow spatial queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%plans%' AND query LIKE '%location%'
ORDER BY mean_exec_time DESC LIMIT 10;
```

### Index Maintenance (weekly)
```sql
-- Rebuild if fragmentation > 20%
REINDEX INDEX CONCURRENTLY idx_plans_bvcoe_active_location;
ANALYZE plans;
```

---

## Rollback Plan

If issues arise:
```sql
-- Disable RPC functions
DROP FUNCTION fetch_plans_near_me(...);
DROP FUNCTION fetch_plans_in_bbox(...);
DROP FUNCTION fetch_nearest_plans(...);
DROP FUNCTION fetch_plans_near_me_paginated(...);

-- Drop indexes
DROP INDEX IF EXISTS idx_plans_bvcoe_active_location;
DROP INDEX IF EXISTS idx_plans_campus_active_location;
DROP INDEX IF EXISTS idx_plans_location_gist;

-- Drop column (data preserved in lat/lng)
ALTER TABLE plans DROP COLUMN IF EXISTS location;
```

Client falls back to legacy `fetchPlansLegacy()` automatically.

---

## Fable-5 Audit Traceability

| Finding | Fix | File |
|---|---|---|
| High-concurrency spatial query bottleneck | Partial GiST index on `location` WHERE `is_active AND campus='BVCOE Dhankawadi'` | `20260728000001_postgis_spatial_index.sql` |
| Client-side Haversine on 3000 rows | Server-side `ST_DWithin` + KNN `<->` via RPC | `20260728000002_postgis_rpc_functions.sql` |
|