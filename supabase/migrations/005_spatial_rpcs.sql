-- IGDTUW Spatial RPCs — PROMPT 11
-- PostGIS functions for spatial queries referenced in src/lib/supabase/queries.ts
-- Run in Supabase SQL Editor AFTER 001_initial_schema.sql

-- Enable PostGIS if not already
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ---------------------------------------------------------------------------
-- 1. parcels_within_bbox(min_lng, min_lat, max_lng, max_lat)
-- Returns parcels whose geometry is within the given bounding box (EPSG:4326)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parcels_within_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
RETURNS SETOF public.parcels
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, postgis
AS $$
  SELECT p.*
  FROM public.parcels p
  WHERE p.geometry IS NOT NULL
    AND ST_Within(
      p.geometry,
      ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    );
$$;

-- ---------------------------------------------------------------------------
-- 2. parcels_nearby(lat, lng, radius_meters)
-- Returns parcels within radius_meters of the given point (EPSG:4326)
-- Uses geography for accurate distance calculation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parcels_nearby(
  lat double precision,
  lng double precision,
  radius_meters double precision
)
RETURNS SETOF public.parcels
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, postgis
AS $$
  SELECT p.*
  FROM public.parcels p
  WHERE p.geometry IS NOT NULL
    AND ST_DWithin(
      p.geometry::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_meters
    );
$$;

-- ---------------------------------------------------------------------------
-- 3. parcels_intersecting_corridor(corridor_geojson)
-- Returns parcels intersecting the given corridor geometry (GeoJSON)
-- corridor_geojson: JSONB with GeoJSON geometry (Polygon/MultiPolygon)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parcels_intersecting_corridor(
  corridor jsonb
)
RETURNS SETOF public.parcels
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, postgis
AS $$
  SELECT p.*
  FROM public.parcels p
  WHERE p.geometry IS NOT NULL
    AND ST_Intersects(
      p.geometry,
      ST_SetSRID(ST_GeomFromGeoJSON(corridor::text), 4326)
    );
$$;

-- ---------------------------------------------------------------------------
-- 4. get_parcel_current_stages(p_project_id)
-- Returns the current stage (highest stage_number with in_progress or completed status)
-- for each parcel, optionally filtered by project_id.
-- Used by Dashboard to count parcels once per current stage.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_parcel_current_stages(
  p_project_id varchar(255) DEFAULT NULL
)
RETURNS TABLE (stage_number integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.stage_number
  FROM public.acquisition_stages s
  JOIN public.parcels p ON p.id = s.parcel_id
  WHERE s.status IN ('in_progress', 'completed')
    AND (p_project_id IS NULL OR p.project_id = p_project_id)
    AND s.stage_number = (
      SELECT MAX(s2.stage_number)
      FROM public.acquisition_stages s2
      WHERE s2.parcel_id = s.parcel_id
        AND s2.status IN ('in_progress', 'completed')
    );
$$;

-- ---------------------------------------------------------------------------
-- Indexes to support the above queries (if not already created)
-- ---------------------------------------------------------------------------
-- GiST index on parcels.geometry already created in 001_initial_schema.sql
-- CREATE INDEX IF NOT EXISTS idx_parcels_geometry ON public.parcels USING GIST (geometry);

-- Grant execute to authenticated role (Supabase default)
GRANT EXECUTE ON FUNCTION public.parcels_within_bbox(double precision, double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parcels_nearby(double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parcels_intersecting_corridor(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parcel_current_stages(varchar(255)) TO authenticated;