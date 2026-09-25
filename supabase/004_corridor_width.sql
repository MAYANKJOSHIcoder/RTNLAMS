-- ===========================================================================
-- 004_corridor_width.sql — corridor matching becomes an area, not a zero-width
-- line. Apply in the Supabase SQL editor (as postgres), same as 001/002/003.
--
-- Before: parcels_intersecting_corridor(corridor JSONB) used ST_Intersects
--         against the drawn polyline, so only parcels the stroke literally
--         crossed matched. A highway/rail corridor is a strip of land, not a
--         hairline.
-- After:  parcels_intersecting_corridor(corridor JSONB, width_meters FLOAT)
--         uses ST_DWithin(parcel::geography, corridor::geography, width_meters)
--         — width_meters = 0 reproduces the old behaviour exactly.
--
-- The parameter list changes, so this DROPs the old 1-arg overload first:
-- keeping both would leave PostgREST with two candidates.
-- Security mode matches 003 (SECURITY INVOKER + pinned search_path) so the
-- existing RLS policies keep filtering the result and 003's self-check passes.
-- ===========================================================================

DROP FUNCTION IF EXISTS public.parcels_intersecting_corridor(jsonb);
DROP FUNCTION IF EXISTS public.parcels_intersecting_corridor(jsonb, float);
DROP FUNCTION IF EXISTS public.parcels_intersecting_corridor(text);

CREATE OR REPLACE FUNCTION public.parcels_intersecting_corridor(
  corridor JSONB, width_meters FLOAT DEFAULT 0
)
RETURNS SETOF public.parcels
LANGUAGE sql STABLE
SET search_path = public, extensions, postgis AS $$
  SELECT p.* FROM public.parcels p
  WHERE ST_DWithin(
    COALESCE(
      p.geometry::geometry,
      CASE
        WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)
        ELSE NULL
      END
    )::geography,
    ST_SetSRID(ST_GeomFromGeoJSON(corridor::text), 4326)::geography,
    GREATEST(COALESCE(width_meters, 0), 0)
  );
$$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'parcels_intersecting_corridor' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION '004: corridor RPC must stay SECURITY INVOKER (see 003)';
  END IF;
  RAISE NOTICE '004_corridor_width applied OK';
END $$;

-- Force PostgREST to immediately refresh its schema cache without restarting the database:
NOTIFY pgrst, 'reload schema';

