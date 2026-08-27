-- Fix: Drop existing functions first, then recreate with correct signatures
-- Run this in Supabase SQL Editor BEFORE the other migrations

-- Drop existing functions that conflict
DROP FUNCTION IF EXISTS public.join_plan(uuid, uuid);
DROP FUNCTION IF EXISTS public.leave_plan(uuid, uuid);
DROP FUNCTION IF EXISTS public.cancel_plan(uuid, uuid);
DROP FUNCTION IF EXISTS public.cleanup_expired_plans();
DROP FUNCTION IF EXISTS public.fetch_plans_near_me(double precision, double precision, integer, integer, uuid);
DROP FUNCTION IF EXISTS public.fetch_plans_near_me_paginated(double precision, double precision, integer, integer, integer, uuid);
DROP FUNCTION IF EXISTS public.fetch_plans_in_bbox(double precision, double precision, double precision, double precision, integer, integer, uuid);

-- Now run the baseline migration, then the fix migrations