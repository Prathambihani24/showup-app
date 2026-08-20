// lib/spatial-queries.js
// Optimized PostGIS spatial queries for Showup "plans near me"
// Uses GiST indexes from migration 20260728000001_postgis_spatial_index.sql

import { supabase } from '../supabase';

// BVCOE Dhankawadi campus center coordinates
export const BVCOE_CAMPUS = {
  name: 'BVCOE Dhankawadi',
  lat: 18.4592,
  lng: 73.8567,
  // 5km radius covers entire BVCOE campus + surrounding student areas
  defaultRadiusMeters: 5000,
};

/**
 * Optimized "Plans Near Me" query using PostGIS KNN + radius filter
 * Uses partial GiST index: idx_plans_bvcoe_active_location
 * Expected: <5ms p99 for 3000 active plans at BVCOE
 * 
 * @param {Object} params
 * @param {number} params.lat - User latitude
 * @param {number} params.lng - User longitude  
 * @param {number} [params.radiusMeters=5000] - Search radius in meters
 * @param {number} [params.limit=20] - Max results
 * @param {string} [params.campus='BVCOE Dhankawadi'] - Campus filter
 * @returns {Promise<{data, error}>}
 */
export async function fetchPlansNearMe({
  lat = BVCOE_CAMPUS.lat,
  lng = BVCOE_CAMPUS.lng,
  radiusMeters = BVCOE_CAMPUS.defaultRadiusMeters,
  limit = 20,
  campus = BVCOE_CAMPUS.name,
} = {}) {
  // Use PostGIS ST_DWithin for radius filter + KNN ordering (<-> operator)
  // The partial index idx_plans_bvcoe_active_location covers:
  //   WHERE is_active = true AND campus = 'BVCOE Dhankawadi'
  // Both ST_DWithin and <-> operator can use this GiST index
  
  const { data, error } = await supabase.rpc('fetch_plans_near_me', {
    user_lat: lat,
    user_lng: lng,
    search_radius_m: radiusMeters,
    result_limit: limit,
    campus_name: campus,
  });

  return { data, error };
}

/**
 * Optimized bounding box query for map viewport
 * Uses full GiST index: idx_plans_location_gist (or partial if campus filtered)
 * 
 * @param {Object} params
 * @param {number} params.minLng - Min longitude (west)
 * @param {number} params.minLat - Min latitude (south)
 * @param {number} params.maxLng - Max longitude (east)
 * @param {number} params.maxLat - Max latitude (north)
 * @param {number} [params.limit=50]
 * @param {string} [params.campus]
 * @returns {Promise<{data, error}>}
 */
export async function fetchPlansInViewport({
  minLng,
  minLat,
  maxLng,
  maxLat,
  limit = 50,
  campus,
} = {}) {
  // Build query with ST_MakeEnvelope for bounding box
  let query = supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .limit(limit);

  if (campus) {
    query = query.eq('campus', campus);
  }

  // PostGIS bounding box intersection (&& operator uses GiST index)
  // Note: Supabase client doesn't directly support PostGIS operators
  // Use RPC or raw SQL for bbox queries
  const { data, error } = await supabase.rpc('fetch_plans_in_bbox', {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
    result_limit: limit,
    campus_name: campus,
  });

  return { data, error };
}

/**
 * Optimized KNN query: closest N plans to user
 * Pure KNN ordering using <-> operator on GiST index
 * 
 * @param {Object} params
 * @param {number} params.lat
 * @param {number} params.lng
 * @param {number} [params.limit=10]
 * @param {string} [params.campus]
 * @returns {Promise<{data, error}>}
 */
export async function fetchNearestPlans({
  lat = BVCOE_CAMPUS.lat,
  lng = BVCOE_CAMPUS.lng,
  limit = 10,
  campus = BVCOE_CAMPUS.name,
} = {}) {
  const { data, error } = await supabase.rpc('fetch_nearest_plans', {
    user_lat: lat,
    user_lng: lng,
    result_limit: limit,
    campus_name: campus,
  });

  return { data, error };
}

/**
 * Hybrid query: campus filter + radius + distance ordering + pagination
 * Most efficient for paginated "plans near me" feed
 * Uses cursor-based pagination with distance for consistent results
 * 
 * @param {Object} params
 * @param {number} params.lat
 * @param {number} params.lng
 * @param {number} [params.radiusMeters=5000]
 * @param {number} [params.limit=20]
 * @param {number} [params.cursorDistanceMeters] - For pagination (last item's distance)
 * @param {string} [params.campus]
 * @returns {Promise<{data, error, nextCursor}>}
 */
export async function fetchPlansNearMePaginated({
  lat = BVCOE_CAMPUS.lat,
  lng = BVCOE_CAMPUS.lng,
  radiusMeters = BVCOE_CAMPUS.defaultRadiusMeters,
  limit = 20,
  cursorDistanceMeters,
  campus = BVCOE_CAMPUS.name,
} = {}) {
  const { data, error } = await supabase.rpc('fetch_plans_near_me_paginated', {
    user_lat: lat,
    user_lng: lng,
    search_radius_m: radiusMeters,
    result_limit: limit,
    cursor_distance_m: cursorDistanceMeters,
    campus_name: campus,
  });

  return { data, error };
}

/**
 * Calculate distance between two points (client-side fallback)
 * Uses Haversine formula - matches PostGIS ST_Distance on geography
 * @returns {number} Distance in kilometers
 */
export function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * Format distance for display
 * @returns {string} e.g., "1.2 km" or "350 m"
 */
export function formatDistance(km) {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

export default {
  fetchPlansNearMe,
  fetchPlansInViewport,
  fetchNearestPlans,
  fetchPlansNearMePaginated,
  calculateDistanceKm,
  formatDistance,
  BVCOE_CAMPUS,
};