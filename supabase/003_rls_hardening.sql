-- ===========================================================================
-- 003_rls_hardening.sql — closes two PII leaks found in the security audit,
-- fixes the broken storage-delete flow. Apply in the Supabase SQL editor
-- (as postgres), same as 001/002. Idempotent + self-checking at the end.
--
--   1. Spatial RPCs were SECURITY DEFINER → they bypassed RLS and returned
--      EVERY parcel (incl. owner_aadhaar) to ANY logged-in user who swept
--      the map. Now SECURITY INVOKER: the existing citizen/staff parcels
--      policies filter the result automatically. No app change.
--   2. Storage "auth read all buckets" let every authenticated user
--      list/download ALL objects. Replaced by per-bucket, per-role policies:
--      staff = all three buckets; citizens = documents under their own
--      parcels only (path = "<parcelId>/..."). Signed URLs are unchanged.
--   3. Adds the missing DELETE policy so useDeleteDocument()'s
--      storage.remove() finally works (uploader + admin).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Spatial RPCs — same client contract (param names unchanged),
--    invoker rights, search_path pin kept.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parcels_within_bbox(
  min_lng FLOAT, min_lat FLOAT, max_lng FLOAT, max_lat FLOAT
)
RETURNS SETOF public.parcels
LANGUAGE sql STABLE
SET search_path = public, extensions, postgis AS $$
  SELECT p.* FROM public.parcels p
  WHERE (
      p.geometry IS NOT NULL
      AND ST_Within(p.geometry, ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326))
    )
    OR (
      p.geometry IS NULL
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
      AND p.longitude BETWEEN min_lng AND max_lng
      AND p.latitude BETWEEN min_lat AND max_lat
    );
$$;

CREATE OR REPLACE FUNCTION public.parcels_nearby(
  lat FLOAT, lng FLOAT, radius_meters FLOAT
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
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_meters
  );
$$;

-- Drop the 1-arg overload if present from 001/prior runs
DROP FUNCTION IF EXISTS public.parcels_intersecting_corridor(jsonb);
DROP FUNCTION IF EXISTS public.parcels_intersecting_corridor(text);

CREATE OR REPLACE FUNCTION public.parcels_intersecting_corridor(
  corridor JSONB, width_meters FLOAT
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
    GREATEST(width_meters, 0)
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Storage policies — drop the broad pair (001-era) and the new set
--    (idempotent re-runs).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "auth read all buckets"   ON storage.objects;
DROP POLICY IF EXISTS "auth write documents"    ON storage.objects;
DROP POLICY IF EXISTS "003_documents_read"      ON storage.objects;
DROP POLICY IF EXISTS "003_documents_upload"    ON storage.objects;
DROP POLICY IF EXISTS "003_documents_delete"    ON storage.objects;
DROP POLICY IF EXISTS "003_staff_buckets_read"  ON storage.objects;
DROP POLICY IF EXISTS "003_staff_buckets_upload" ON storage.objects;
DROP POLICY IF EXISTS "003_staff_buckets_delete" ON storage.objects;

-- documents: staff read all; citizen reads only paths under own parcels
-- (mirrors citizen_parcels: aadhaar match via own profile row).
CREATE POLICY "003_documents_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'documents'
  AND (
    public.current_user_role() IN ('admin','auditor','field_officer')
    OR (
      public.current_user_role() = 'citizen'
      AND EXISTS (
        SELECT 1 FROM public.parcels p
        WHERE p.id = (storage.foldername("name"))[1]
          AND p.owner_aadhaar = (SELECT up.aadhaar FROM public.user_profiles up WHERE up.id = auth.uid())
      )
    )
  )
);

-- uploads are staff flows (DocumentUpload is FO/admin UI); upsert:false everywhere
-- → no UPDATE policy needed (ponytail: add one if replace-in-place ever ships).
CREATE POLICY "003_documents_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'documents'
  AND public.current_user_role() IN ('admin','field_officer')
);

CREATE POLICY "003_documents_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'documents'
  AND (public.current_user_role() = 'admin' OR "owner"::text = auth.uid()::text)
);

-- audit-evidence + hearing-minutes: staff only (paths carry no parcel link;
-- citizen evidence UI already null-degrades via getSignedUrl returning null).
CREATE POLICY "003_staff_buckets_read" ON storage.objects FOR SELECT USING (
  bucket_id IN ('audit-evidence','hearing-minutes')
  AND public.current_user_role() IN ('admin','auditor','field_officer')
);

CREATE POLICY "003_staff_buckets_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id IN ('audit-evidence','hearing-minutes')
  AND public.current_user_role() IN ('admin','auditor','field_officer')
);

CREATE POLICY "003_staff_buckets_delete" ON storage.objects FOR DELETE USING (
  bucket_id IN ('audit-evidence','hearing-minutes')
  AND (public.current_user_role() = 'admin' OR "owner"::text = auth.uid()::text)
);

-- ---------------------------------------------------------------------------
-- 3. Self-check — the script fails loudly if it half-applied.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN ('auth read all buckets','auth write documents')
  ) THEN
    RAISE EXCEPTION '003: broad storage policies still present';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('parcels_within_bbox','parcels_nearby','parcels_intersecting_corridor')
      AND p.prosecdef
  ) THEN
    RAISE EXCEPTION '003: spatial RPCs still SECURITY DEFINER';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE '003_%') <> 6 THEN
    RAISE EXCEPTION '003: expected 6 storage policies, found %',
      (SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE '003_%');
  END IF;
  RAISE NOTICE '003_rls_hardening applied OK';
END $$;
