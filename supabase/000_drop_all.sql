-- ===========================================================================
-- RTNLAMS — FULL RESET: drop all schema objects + storage policies.
-- Run in Supabase SQL Editor BEFORE 001_schema.sql + 002_seed.sql to rebuild
-- from scratch. Safe to run on an empty/absent schema (everything is IF EXISTS).
--
-- Storage NOTE: rows in storage.objects / storage.buckets CANNOT be deleted
-- via SQL (Supabase's protect_delete trigger). After this script, empty +
-- delete the 3 buckets in Dashboard → Storage, or leave the buckets — they
-- are re-created idempotently by 001_schema.sql.
-- ===========================================================================

-- tables (policies, triggers, FK indexes go with them)
DROP TABLE IF EXISTS
  public.notifications,
  public.query_messages,
  public.queries,
  public.risk_assessments,
  public.audit_logs,
  public.compensation_awards,
  public.hearings,
  public.documents,
  public.acquisition_stages,
  public.parcels,
  public.stage_defs,
  public.projects,
  public.user_profiles
CASCADE;

-- functions (CASCADE also removes on_auth_user_created on auth.users)
DROP FUNCTION IF EXISTS public.notify_on_query_created() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_query_message() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_query_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.push_notification_to_staff(text, text, text, varchar, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.push_notification(uuid, text, text, text, text, text, varchar, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.query_parcel_label(varchar) CASCADE;
DROP FUNCTION IF EXISTS public.advance_parcel_stage(text) CASCADE;
DROP FUNCTION IF EXISTS public.resolve_breached_stage(text, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS public.mark_overdue_breached() CASCADE;
DROP FUNCTION IF EXISTS public.set_payment_status(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.sync_parcel_status() CASCADE;
DROP FUNCTION IF EXISTS public.seed_parcel_stages() CASCADE;
DROP FUNCTION IF EXISTS public.guard_profile_updates() CASCADE;
DROP FUNCTION IF EXISTS public.set_created_by() CASCADE;
DROP FUNCTION IF EXISTS public.set_uploaded_by() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.make_parcel_square(float, float, float) CASCADE;
DROP FUNCTION IF EXISTS public.sync_parcel_geometry() CASCADE;
DROP FUNCTION IF EXISTS public.parcels_within_bbox(float, float, float, float) CASCADE;
DROP FUNCTION IF EXISTS public.parcels_nearby(float, float, float) CASCADE;
DROP FUNCTION IF EXISTS public.parcels_nearby(float, float, integer) CASCADE;
DROP FUNCTION IF EXISTS public.parcels_intersecting_corridor(jsonb, float) CASCADE;
DROP FUNCTION IF EXISTS public.parcels_intersecting_corridor(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.parcels_intersecting_corridor(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_parcel_current_stages(text) CASCADE;

-- storage-layer policies (DDL on storage.objects IS allowed — unlike DELETE)
DO $$ DECLARE p TEXT; BEGIN
  FOREACH p IN ARRAY ARRAY[
    'auth read all buckets', 'auth write documents',
    '003_documents_read',
    '003_documents_upload',
    '003_documents_delete',
    '003_staff_buckets_read',
    '003_staff_buckets_upload',
    '003_staff_buckets_delete',
    'Authenticated users can upload documents',
    'Authenticated users can update their documents',
    'Authenticated users can delete their documents',
    'Public read access to documents',
    'Authenticated users can upload audit evidence',
    'Authenticated users can update their audit evidence',
    'Authenticated users can delete their audit evidence',
    'Public read access to audit evidence',
    'Authenticated users can upload hearing minutes',
    'Authenticated users can update their hearing minutes',
    'Authenticated users can delete their hearing minutes',
    'Public read access to hearing minutes'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', p);
  END LOOP;
END $$;

-- verify clean:
-- SELECT policyname FROM pg_policies WHERE schemaname = 'storage';  -- 0 rows
