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
-- Indexes to support the above queries (if not already created)
-- ---------------------------------------------------------------------------
-- GiST index on parcels.geometry already created in 001_initial_schema.sql
-- CREATE INDEX IF NOT EXISTS idx_parcels_geometry ON public.parcels USING GIST (geometry);

-- Grant execute to authenticated role (Supabase default)
GRANT EXECUTE ON FUNCTION public.parcels_within_bbox(double precision, double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parcels_nearby(double precision, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parcels_intersecting_corridor(jsonb) TO authenticated;