-- ===========================================================================
-- RTNLAMS — Land Acquisition Management System
-- COMPLETE SCHEMA for fresh Supabase setup (run this first, then 002_seed.sql)
--
-- Apply in Supabase SQL Editor:
--   0. (existing project only) 000_drop_all.sql — resets schema + storage policies
--   1. This file (001_schema.sql)
--   2. 002_seed.sql
--   3. Register 4 accounts via the app UI (any emails), then assign roles:
--        scripts/set-role.mjs <email> admin
--        scripts/set-role.mjs <email> field_officer
--        scripts/set-role.mjs <email> auditor
--      (citizen is the default role on registration)
--
-- Supersedes migrations 001-006. Fixes baked in:
--   - parcels.id DEFAULT gen_random_uuid()  (add-parcel not-null bug)
--   - aadhaar (12-digit Indian ID) instead of cnic
--   - stage_defs lookup + auto-seed 12 stages on parcel insert (atomic)
--   - SLA deadlines stamped when a stage STARTS, not at parcel birth
--   - parcels.status auto-synced from completed stage count (disputed manual)
--   - advance/resolve/mark-overdue/payment RPCs (atomic, role-checked)
--   - RLS role matrix: admin full; FO see-all/edit-own; auditor read+audit;
--     citizen own-parcel-only via aadhaar; role changes admin-only
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Creates a small visible parcel box around a real lat/lng point.
-- Use this for demo/imported parcels when exact survey boundaries are absent.
CREATE OR REPLACE FUNCTION public.make_parcel_square(
  p_lat FLOAT,
  p_lng FLOAT,
  p_half_size FLOAT DEFAULT 0.004
)
RETURNS GEOMETRY(Polygon,4326) AS $$
  SELECT ST_MakeEnvelope(
    p_lng - p_half_size,
    p_lat - p_half_size,
    p_lng + p_half_size,
    p_lat + p_half_size,
    4326
  )::GEOMETRY(Polygon,4326);
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.sync_parcel_geometry()
RETURNS TRIGGER AS $$
DECLARE
  c GEOMETRY(Point,4326);
BEGIN
  IF NEW.latitude IS NOT NULL AND (NEW.latitude < -90 OR NEW.latitude > 90) THEN
    RAISE EXCEPTION 'latitude must be between -90 and 90';
  END IF;
  IF NEW.longitude IS NOT NULL AND (NEW.longitude < -180 OR NEW.longitude > 180) THEN
    RAISE EXCEPTION 'longitude must be between -180 and 180';
  END IF;
  IF (NEW.latitude IS NULL) <> (NEW.longitude IS NULL) THEN
    RAISE EXCEPTION 'latitude and longitude must be provided together';
  END IF;

  IF NEW.geometry IS NULL AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geometry := public.make_parcel_square(NEW.latitude::FLOAT, NEW.longitude::FLOAT);
  END IF;

  IF NEW.geometry IS NOT NULL AND (NEW.latitude IS NULL OR NEW.longitude IS NULL) THEN
    c := ST_PointOnSurface(NEW.geometry);
    NEW.latitude := ST_Y(c);
    NEW.longitude := ST_X(c);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. user_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','field_officer','auditor','citizen')),
  aadhaar TEXT CHECK (aadhaar IS NULL OR aadhaar ~ '^\d{12}$'),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Current user's role (SECURITY DEFINER: avoids RLS recursion on user_profiles).
-- Declared AFTER user_profiles — LANGUAGE sql bodies are parsed at creation time.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- 2. stage_defs — single source of the 12-stage lifecycle (used by
--    seed_parcel_stages, advance_parcel_stage; mirrors src/lib/stages.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE public.stage_defs (
  stage_number INT PRIMARY KEY CHECK (stage_number BETWEEN 1 AND 12),
  stage_name TEXT NOT NULL,
  sla_days INT, -- NULL = open-ended (no SLA)
  description TEXT
);

INSERT INTO public.stage_defs (stage_number, stage_name, sla_days, description) VALUES
  (1,  'Corridor Planning',          NULL, 'Map project corridors and match alignments'),
  (2,  'Preliminary Survey',         15,   'Field survey & plot identification'),
  (3,  'Social Impact Assessment',   30,   'SIA report & affected families count'),
  (4,  'Notification U/S 19',        30,   'Statutory notification under RFCTLARR Section 19'),
  (5,  'Objection Handling',         30,   'Receive & dispose objections'),
  (6,  'Public Hearing',             15,   'Gram sabha / public hearing minutes'),
  (7,  'Valuation Report',           30,   'Land & asset valuation by collector'),
  (8,  'Award Declaration',          30,   'Award under Section 23'),
  (9,  'Compensation Deposit',       30,   'Deposit in escrow / pay to owners'),
  (10, 'Possession Handover',        15,   'Physical possession to acquiring body'),
  (11, 'Title Transfer',            30,   'Mutation & title transfer in records'),
  (12, 'Satellite Monitoring',       NULL, 'Post-acquisition encroachment monitoring');

-- ---------------------------------------------------------------------------
-- 3. projects
-- ---------------------------------------------------------------------------
CREATE TABLE public.projects (
  id varchar(255) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  corridor_type TEXT NOT NULL CHECK (corridor_type IN ('highway','rail','industrial','other')),
  status TEXT NOT NULL CHECK (status IN ('planning','active','completed','on_hold')) DEFAULT 'planning',
  total_parcels INT NOT NULL DEFAULT 0,
  total_area_hectares NUMERIC(12,2) NOT NULL DEFAULT 0,
  corridor_geometry GEOMETRY(Geometry,4326),
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. parcels  — id has a default now (the old add-parcel bug)
-- ---------------------------------------------------------------------------
CREATE TABLE public.parcels (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id varchar(255) NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parcel_number TEXT NOT NULL UNIQUE,
  owner_name TEXT NOT NULL,
  owner_aadhaar TEXT CHECK (owner_aadhaar IS NULL OR owner_aadhaar ~ '^\d{12}$'),
  area_hectares NUMERIC(12,4) NOT NULL,
  land_use TEXT,
  geometry GEOMETRY(Polygon,4326),
  latitude NUMERIC(9,6) CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude NUMERIC(9,6) CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  status TEXT NOT NULL CHECK (status IN ('identified','notified','surveyed','acquired','disputed')) DEFAULT 'identified',
  risk_score NUMERIC(3,2) CHECK (risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 1)),
  survey_number TEXT,
  village TEXT,
  district TEXT,
  state TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 5. documents
-- ---------------------------------------------------------------------------
CREATE TABLE public.documents (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id varchar(255) NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_url TEXT NOT NULL, -- storage path within the documents bucket
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  ocr_extracted_data JSONB,
  ocr_raw_text TEXT,
  translated_text TEXT,
  ocr_confidence NUMERIC(3,2) CHECK (ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 1)),
  language TEXT,
  status TEXT NOT NULL CHECK (status IN ('uploaded','processing','extracted','verified','flagged')) DEFAULT 'uploaded',
  uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  verified_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 6. acquisition_stages — all writes go through the RPCs (RLS: SELECT only
--    for non-admin). sla_deadline is stamped when a stage BECOMES in_progress.
-- ---------------------------------------------------------------------------
CREATE TABLE public.acquisition_stages (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id varchar(255) NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  stage_number INT NOT NULL CHECK (stage_number BETWEEN 1 AND 12),
  stage_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','in_progress','completed','breached')) DEFAULT 'pending',
  assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  sla_deadline TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(parcel_id, stage_number)
);

-- ---------------------------------------------------------------------------
-- 7. hearings
-- ---------------------------------------------------------------------------
CREATE TABLE public.hearings (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id varchar(255) NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  hearing_date TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('objection','valuation','final','public')),
  outcome TEXT,
  attendees JSONB,
  notes TEXT,
  minutes_file_url TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 8. compensation_awards
-- ---------------------------------------------------------------------------
CREATE TABLE public.compensation_awards (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id varchar(255) NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  calculated_amount NUMERIC(14,2),
  awarded_amount NUMERIC(14,2) NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending','initiated','completed','failed')) DEFAULT 'pending',
  payment_date TIMESTAMPTZ,
  payment_reference TEXT,
  circle_rate_per_sqm NUMERIC(12,2),
  area_sqm NUMERIC(12,2),
  multiplier JSONB,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 9. audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id varchar(255) REFERENCES public.parcels(id) ON DELETE CASCADE,
  audit_type TEXT NOT NULL CHECK (audit_type IN ('satellite','field','compliance')),
  finding TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')) DEFAULT 'medium',
  image_url TEXT,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 10. risk_assessments
-- ---------------------------------------------------------------------------
CREATE TABLE public.risk_assessments (
  id varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id varchar(255) NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  ownership_score NUMERIC(3,2) NOT NULL CHECK (ownership_score BETWEEN 0 AND 1),
  litigation_score NUMERIC(3,2) NOT NULL CHECK (litigation_score BETWEEN 0 AND 1),
  compensation_sla_score NUMERIC(3,2) NOT NULL CHECK (compensation_sla_score BETWEEN 0 AND 1),
  completeness_score NUMERIC(3,2) NOT NULL CHECK (completeness_score BETWEEN 0 AND 1),
  document_quality_score NUMERIC(3,2) NOT NULL CHECK (document_quality_score BETWEEN 0 AND 1),
  area_discrepancy_score NUMERIC(3,2) NOT NULL CHECK (area_discrepancy_score BETWEEN 0 AND 1),
  encroachment_score NUMERIC(3,2) NOT NULL CHECK (encroachment_score BETWEEN 0 AND 1),
  overall_risk NUMERIC(3,2) NOT NULL CHECK (overall_risk BETWEEN 0 AND 1),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  factors JSONB,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assessed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  UNIQUE(parcel_id, assessed_at)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_parcels_geometry ON public.parcels USING GIST (geometry);
CREATE INDEX idx_projects_corridor_geometry ON public.projects USING GIST (corridor_geometry);
CREATE INDEX idx_parcels_project_id ON public.parcels(project_id);
CREATE INDEX idx_parcels_created_by ON public.parcels(created_by);
CREATE INDEX idx_parcels_owner_aadhaar ON public.parcels(owner_aadhaar);
CREATE INDEX idx_parcels_status ON public.parcels(status);
CREATE INDEX idx_documents_parcel_id ON public.documents(parcel_id);
CREATE INDEX idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX idx_documents_ocr_gin ON public.documents USING GIN (ocr_extracted_data);
CREATE INDEX idx_stages_parcel_id ON public.acquisition_stages(parcel_id);
CREATE INDEX idx_stages_assigned_to ON public.acquisition_stages(assigned_to);
CREATE INDEX idx_hearings_parcel_id ON public.hearings(parcel_id);
CREATE INDEX idx_hearings_created_by ON public.hearings(created_by);
CREATE INDEX idx_hearings_attendees_gin ON public.hearings USING GIN (attendees);
CREATE INDEX idx_compensation_parcel_id ON public.compensation_awards(parcel_id);
CREATE INDEX idx_compensation_created_by ON public.compensation_awards(created_by);
CREATE INDEX idx_compensation_multiplier_gin ON public.compensation_awards USING GIN (multiplier);
CREATE INDEX idx_audit_parcel_id ON public.audit_logs(parcel_id);
CREATE INDEX idx_audit_created_by ON public.audit_logs(created_by);
CREATE INDEX idx_risk_parcel_id ON public.risk_assessments(parcel_id);
CREATE INDEX idx_risk_factors_gin ON public.risk_assessments USING GIN (factors);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_user_profiles_aadhaar ON public.user_profiles(aadhaar);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_user_profiles_updated BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_parcels_geometry BEFORE INSERT OR UPDATE ON public.parcels FOR EACH ROW EXECUTE FUNCTION public.sync_parcel_geometry();
CREATE TRIGGER trg_parcels_updated BEFORE UPDATE ON public.parcels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_stages_updated BEFORE UPDATE ON public.acquisition_stages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_hearings_updated BEFORE UPDATE ON public.hearings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_compensation_updated BEFORE UPDATE ON public.compensation_awards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_updated BEFORE UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- auth.users → user_profiles (role ALWAYS citizen; staff via set-role.mjs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role, aadhaar)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'citizen',
    NULLIF(NEW.raw_user_meta_data->>'aadhaar', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Role/aadhaar lock — users can NEVER change their own role or aadhaar.
-- (Kills self-escalation to admin and aadhaar-swap to view others' parcels.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.aadhaar IS DISTINCT FROM OLD.aadhaar THEN
    IF public.current_user_role() = 'admin' THEN
      RETURN NEW; -- admins may adjust roles/aadhaar
    END IF;
    -- service_role / SQL editor / postgres maintenance sessions bypass auth.uid()
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'role/aadhaar changes are admin-only';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_guard_profile_updates
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_updates();

-- ---------------------------------------------------------------------------
-- Auto-fill created_by / uploaded_by (server-side, cannot be spoofed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_created_by_parcels BEFORE INSERT ON public.parcels FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
CREATE TRIGGER trg_set_created_by_hearings BEFORE INSERT ON public.hearings FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
CREATE TRIGGER trg_set_created_by_compensation BEFORE INSERT ON public.compensation_awards FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
CREATE TRIGGER trg_set_created_by_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

CREATE OR REPLACE FUNCTION public.set_uploaded_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.uploaded_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.uploaded_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_uploaded_by_documents BEFORE INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_uploaded_by();

-- ---------------------------------------------------------------------------
-- Seed 12 stage rows on every parcel insert (atomic with the insert —
-- no crash window, works for CSV bulk too). Stage 1 in_progress, rest
-- pending, and NO sla_deadline until a stage starts (no phantom breaches).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_parcel_stages()
RETURNS TRIGGER AS $$
DECLARE d RECORD;
BEGIN
  FOR d IN SELECT * FROM public.stage_defs ORDER BY stage_number LOOP
    INSERT INTO public.acquisition_stages (parcel_id, stage_number, stage_name, status, sla_deadline)
    VALUES (
      NEW.id, d.stage_number, d.stage_name,
      CASE WHEN d.stage_number = 1 THEN 'in_progress' ELSE 'pending' END,
      CASE WHEN d.stage_number = 1 AND d.sla_days IS NOT NULL
           THEN NOW() + (d.sla_days || ' days')::interval
           ELSE NULL END
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_seed_parcel_stages
  AFTER INSERT ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.seed_parcel_stages();

-- ---------------------------------------------------------------------------
-- parcels.status auto-sync from completed stages:
--   >=10 completed → acquired; >=7 → surveyed; >=4 → notified; else identified
-- 'disputed' is NEVER overwritten (manual admin flag).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_parcel_status()
RETURNS TRIGGER AS $$
DECLARE
  v_completed INT;
  v_parcel_status TEXT;
BEGIN
  SELECT count(*) INTO v_completed
  FROM public.acquisition_stages
  WHERE parcel_id = NEW.parcel_id AND status = 'completed';

  SELECT status INTO v_parcel_status FROM public.parcels WHERE id = NEW.parcel_id;
  IF v_parcel_status = 'disputed' THEN
    RETURN NEW; -- keep the manual flag
  END IF;

  UPDATE public.parcels
  SET status = CASE
        WHEN v_completed >= 10 THEN 'acquired'
        WHEN v_completed >= 7 THEN 'surveyed'
        WHEN v_completed >= 4 THEN 'notified'
        ELSE 'identified'
      END
  WHERE id = NEW.parcel_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_parcel_status
  AFTER UPDATE OF status ON public.acquisition_stages
  FOR EACH ROW EXECUTE FUNCTION public.sync_parcel_status();

-- ===========================================================================
-- RPCs (all SECURITY DEFINER, granted to authenticated only)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- advance_parcel_stage: atomically complete the in_progress stage and start
-- the next one. No-skip by construction (only the current stage can move).
-- Breached stages are rejected — resolve first (resolve-then-advance flow).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.advance_parcel_stage(p_stage_id TEXT)
RETURNS public.acquisition_stages
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  st public.acquisition_stages;
  d public.stage_defs;
BEGIN
  v_role := public.current_user_role();
  IF v_role NOT IN ('admin','field_officer') THEN
    RAISE EXCEPTION 'Only admin or field officer can advance stages';
  END IF;

  SELECT * INTO st FROM public.acquisition_stages WHERE id = p_stage_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage not found';
  END IF;

  IF st.status = 'breached' THEN
    RAISE EXCEPTION 'Stage % is breached — resolve the breach first', st.stage_number;
  END IF;
  IF st.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Stage % is not in progress', st.stage_number;
  END IF;

  UPDATE public.acquisition_stages
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_stage_id;

  SELECT * INTO d FROM public.stage_defs WHERE stage_number = st.stage_number + 1;
  IF FOUND THEN
    INSERT INTO public.acquisition_stages (parcel_id, stage_number, stage_name, status, sla_deadline)
    VALUES (st.parcel_id, d.stage_number, d.stage_name, 'in_progress',
            CASE WHEN d.sla_days IS NOT NULL THEN NOW() + (d.sla_days || ' days')::interval ELSE NULL END)
    ON CONFLICT (parcel_id, stage_number) DO UPDATE
      SET status = 'in_progress',
          sla_deadline = COALESCE(public.acquisition_stages.sla_deadline, EXCLUDED.sla_deadline),
          updated_at = NOW();
  END IF;
  -- stage 12 completed → nothing follows; parcel is terminal

  RETURN st;
END;
$$;

-- ---------------------------------------------------------------------------
-- resolve_breached_stage: breached → in_progress with a new deadline + note.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_breached_stage(p_stage_id TEXT, p_new_deadline TIMESTAMPTZ)
RETURNS public.acquisition_stages
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  st public.acquisition_stages;
BEGIN
  v_role := public.current_user_role();
  IF v_role NOT IN ('admin','field_officer') THEN
    RAISE EXCEPTION 'Only admin or field officer can resolve breaches';
  END IF;
  IF p_new_deadline <= NOW() THEN
    RAISE EXCEPTION 'New deadline must be in the future';
  END IF;

  SELECT * INTO st FROM public.acquisition_stages WHERE id = p_stage_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage not found';
  END IF;
  IF st.status <> 'breached' THEN
    RAISE EXCEPTION 'Stage % is not breached', st.stage_number;
  END IF;

  UPDATE public.acquisition_stages
  SET status = 'in_progress',
      sla_deadline = p_new_deadline,
      notes = COALESCE(notes, '') || E'\nBreach resolved at ' || NOW()::text || E' — new deadline ' || p_new_deadline::text,
      updated_at = NOW()
  WHERE id = p_stage_id;

  RETURN st;
END;
$$;

-- ---------------------------------------------------------------------------
-- mark_overdue_breached: flip overdue in_progress stages to breached.
-- Idempotent; any authenticated user (called by the client SLA poller).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_overdue_breached()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INT;
BEGIN
  UPDATE public.acquisition_stages
  SET status = 'breached'
  WHERE status = 'in_progress' AND sla_deadline IS NOT NULL AND sla_deadline < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- set_payment_status: pending → initiated → completed (UTR required) | failed.
-- Admin/FO, works on any award (supersedes created_by-scoped writes).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_payment_status(p_award_id TEXT, p_status TEXT, p_utr TEXT DEFAULT NULL)
RETURNS public.compensation_awards
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  a public.compensation_awards;
BEGIN
  v_role := public.current_user_role();
  IF v_role NOT IN ('admin','field_officer') THEN
    RAISE EXCEPTION 'Only admin or field officer can advance payments';
  END IF;

  SELECT * INTO a FROM public.compensation_awards WHERE id = p_award_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Award not found';
  END IF;

  IF p_status = 'initiated' THEN
    IF a.payment_status <> 'pending' THEN
      RAISE EXCEPTION 'Only pending awards can be initiated (current: %)', a.payment_status;
    END IF;
  ELSIF p_status = 'completed' THEN
    IF a.payment_status NOT IN ('initiated','failed') THEN
      RAISE EXCEPTION 'Only initiated or failed awards can be completed (current: %)', a.payment_status;
    END IF;
    IF p_utr IS NULL OR btrim(p_utr) = '' THEN
      RAISE EXCEPTION 'UTR / payment reference is required to mark paid';
    END IF;
  ELSIF p_status = 'failed' THEN
    IF a.payment_status <> 'initiated' THEN
      RAISE EXCEPTION 'Only initiated awards can fail (current: %)', a.payment_status;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid target status: %', p_status;
  END IF;

  UPDATE public.compensation_awards
  SET payment_status = p_status,
      payment_date = CASE WHEN p_status = 'completed' THEN NOW() ELSE payment_date END,
      payment_reference = CASE WHEN p_status = 'completed' THEN btrim(p_utr)
                               WHEN p_status = 'initiated' THEN payment_reference
                               ELSE NULL END,
      updated_at = NOW()
  WHERE id = p_award_id;

  RETURN a;
END;
$$;

-- ---------------------------------------------------------------------------
-- Spatial RPCs (carried from 005). PARAMETER NAMES ARE THE CLIENT CONTRACT:
-- src/lib/supabase/queries.ts calls {min_lng,min_lat,max_lng,max_lat},
-- {lat,lng,radius_meters}, {corridor: GeoJSON} — PostgREST matches by name.
-- SECURITY DEFINER + search_path pin as in 005 (map shows all parcels).
-- ---------------------------------------------------------------------------
-- Drop the short-lived p_* overloads from earlier 001 revisions if present:
DROP FUNCTION IF EXISTS public.parcels_nearby(float, float, integer);
DROP FUNCTION IF EXISTS public.parcels_intersecting_corridor(text);

CREATE OR REPLACE FUNCTION public.parcels_within_bbox(
  min_lng FLOAT, min_lat FLOAT, max_lng FLOAT, max_lat FLOAT
)
RETURNS SETOF public.parcels
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, extensions, postgis AS $$
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
SECURITY DEFINER SET search_path = public, extensions, postgis AS $$
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

CREATE OR REPLACE FUNCTION public.parcels_intersecting_corridor(corridor JSONB)
RETURNS SETOF public.parcels
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, extensions, postgis AS $$
  SELECT p.* FROM public.parcels p
  WHERE ST_Intersects(
    COALESCE(
      p.geometry::geometry,
      CASE
        WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)
        ELSE NULL
      END
    ),
    ST_SetSRID(ST_GeomFromGeoJSON(corridor::text), 4326)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_parcel_current_stages(p_project_id TEXT DEFAULT NULL)
RETURNS TABLE (parcel_id TEXT, stage_number INT)
LANGUAGE sql STABLE AS $$
  SELECT s.parcel_id, MIN(s.stage_number)::INT AS stage_number
  FROM public.acquisition_stages s
  JOIN public.parcels p ON p.id = s.parcel_id
  WHERE s.status = 'in_progress'
    AND (p_project_id IS NULL OR p.project_id = p_project_id)
  GROUP BY s.parcel_id
  UNION
  SELECT s.parcel_id, MAX(s.stage_number)::INT
  FROM public.acquisition_stages s
  JOIN public.parcels p ON p.id = s.parcel_id
  WHERE s.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM public.acquisition_stages s2
      WHERE s2.parcel_id = s.parcel_id AND s2.status = 'in_progress'
    )
    AND (p_project_id IS NULL OR p.project_id = p_project_id)
  GROUP BY s.parcel_id;
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ===========================================================================
-- RLS
-- ===========================================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acquisition_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensation_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_defs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- ADMIN: full access everywhere
-- ---------------------------------------------------------------------------
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['user_profiles','projects','parcels','documents','acquisition_stages','hearings','compensation_awards','audit_logs','risk_assessments','stage_defs'] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS admin_all ON public.%I; CREATE POLICY admin_all ON public.%I FOR ALL
       USING (public.current_user_role() = ''admin'') WITH CHECK (public.current_user_role() = ''admin'');',
      t, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- stage_defs: readable by all authenticated (board needs the 12 definitions)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS stage_defs_read ON public.stage_defs;
CREATE POLICY stage_defs_read ON public.stage_defs FOR SELECT
  USING (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Self-service profile: users read/update their own row. Role/aadhaar
-- changes are blocked by guard_profile_updates trigger (admin can).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS user_self_profile ON public.user_profiles;
CREATE POLICY user_self_profile ON public.user_profiles
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS staff_read_profiles ON public.user_profiles;
CREATE POLICY staff_read_profiles ON public.user_profiles
  FOR SELECT USING (public.current_user_role() IN ('admin','auditor','field_officer'));

-- ---------------------------------------------------------------------------
-- PROJECTS — all authenticated users read; FO/admin create/update
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS projects_read ON public.projects;
CREATE POLICY projects_read ON public.projects FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS fo_write_projects ON public.projects;
CREATE POLICY fo_write_projects ON public.projects
  FOR ALL USING (public.current_user_role() IN ('admin','field_officer'))
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

-- ---------------------------------------------------------------------------
-- PARCELS — FO: SELECT all, write own (created_by); citizen: own via aadhaar
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS fo_read_parcels ON public.parcels;
CREATE POLICY fo_read_parcels ON public.parcels FOR SELECT
  USING (public.current_user_role() IN ('admin','auditor','field_officer'));

DROP POLICY IF EXISTS fo_insert_parcels ON public.parcels;
CREATE POLICY fo_insert_parcels ON public.parcels FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS fo_update_parcels ON public.parcels;
CREATE POLICY fo_update_parcels ON public.parcels FOR UPDATE
  USING (public.current_user_role() = 'admin' OR (public.current_user_role() = 'field_officer' AND created_by = auth.uid()))
  WITH CHECK (public.current_user_role() = 'admin' OR (public.current_user_role() = 'field_officer' AND created_by = auth.uid()));

DROP POLICY IF EXISTS admin_delete_parcels ON public.parcels;
CREATE POLICY admin_delete_parcels ON public.parcels FOR DELETE
  USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS citizen_parcels ON public.parcels;
CREATE POLICY citizen_parcels ON public.parcels FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND owner_aadhaar IS NOT NULL
  AND owner_aadhaar = (SELECT aadhaar FROM public.user_profiles WHERE id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- DOCUMENTS — FO: SELECT all, write own (uploaded_by); auditor read;
-- citizen: docs of own parcels
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS fo_read_documents ON public.documents;
CREATE POLICY fo_read_documents ON public.documents FOR SELECT
  USING (public.current_user_role() IN ('admin','auditor','field_officer'));

DROP POLICY IF EXISTS fo_insert_documents ON public.documents;
CREATE POLICY fo_insert_documents ON public.documents FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS fo_update_documents ON public.documents;
CREATE POLICY fo_update_documents ON public.documents FOR UPDATE
  USING (public.current_user_role() = 'admin' OR (public.current_user_role() = 'field_officer' AND uploaded_by = auth.uid()))
  WITH CHECK (public.current_user_role() = 'admin' OR (public.current_user_role() = 'field_officer' AND uploaded_by = auth.uid()));

DROP POLICY IF EXISTS admin_delete_documents ON public.documents;
CREATE POLICY admin_delete_documents ON public.documents FOR DELETE
  USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS citizen_documents ON public.documents;
CREATE POLICY citizen_documents ON public.documents FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = documents.parcel_id
      AND p.owner_aadhaar = (SELECT aadhaar FROM public.user_profiles WHERE id = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- ACQUISITION STAGES — SELECT for staff + citizen (own parcels).
-- No direct write policies for FO: all writes flow through the RPCs.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS staff_read_stages ON public.acquisition_stages;
CREATE POLICY staff_read_stages ON public.acquisition_stages FOR SELECT
  USING (public.current_user_role() IN ('admin','auditor','field_officer'));

DROP POLICY IF EXISTS citizen_stages ON public.acquisition_stages;
CREATE POLICY citizen_stages ON public.acquisition_stages FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = acquisition_stages.parcel_id
      AND p.owner_aadhaar = (SELECT aadhaar FROM public.user_profiles WHERE id = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- HEARINGS — FO: SELECT all, write own; auditor read; citizen: own parcels
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS fo_read_hearings ON public.hearings;
CREATE POLICY fo_read_hearings ON public.hearings FOR SELECT
  USING (public.current_user_role() IN ('admin','auditor','field_officer'));

DROP POLICY IF EXISTS fo_insert_hearings ON public.hearings;
CREATE POLICY fo_insert_hearings ON public.hearings FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS fo_update_hearings ON public.hearings;
CREATE POLICY fo_update_hearings ON public.hearings FOR UPDATE
  USING (public.current_user_role() = 'admin' OR (public.current_user_role() = 'field_officer' AND created_by = auth.uid()))
  WITH CHECK (public.current_user_role() = 'admin' OR (public.current_user_role() = 'field_officer' AND created_by = auth.uid()));

DROP POLICY IF EXISTS admin_delete_hearings ON public.hearings;
CREATE POLICY admin_delete_hearings ON public.hearings FOR DELETE
  USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS citizen_hearings ON public.hearings;
CREATE POLICY citizen_hearings ON public.hearings FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = hearings.parcel_id
      AND p.owner_aadhaar = (SELECT aadhaar FROM public.user_profiles WHERE id = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- COMPENSATION AWARDS — FO: SELECT all, write own; auditor read;
-- citizen: own parcels (payment moves go via set_payment_status RPC)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS fo_read_compensation ON public.compensation_awards;
CREATE POLICY fo_read_compensation ON public.compensation_awards FOR SELECT
  USING (public.current_user_role() IN ('admin','auditor','field_officer'));

DROP POLICY IF EXISTS fo_insert_compensation ON public.compensation_awards;
CREATE POLICY fo_insert_compensation ON public.compensation_awards FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS fo_update_compensation ON public.compensation_awards;
CREATE POLICY fo_update_compensation ON public.compensation_awards FOR UPDATE
  USING (public.current_user_role() = 'admin' OR (public.current_user_role() = 'field_officer' AND created_by = auth.uid()))
  WITH CHECK (public.current_user_role() = 'admin' OR (public.current_user_role() = 'field_officer' AND created_by = auth.uid()));

DROP POLICY IF EXISTS admin_delete_compensation ON public.compensation_awards;
CREATE POLICY admin_delete_compensation ON public.compensation_awards FOR DELETE
  USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS citizen_compensation ON public.compensation_awards;
CREATE POLICY citizen_compensation ON public.compensation_awards FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = compensation_awards.parcel_id
      AND p.owner_aadhaar = (SELECT aadhaar FROM public.user_profiles WHERE id = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- AUDIT LOGS — auditor: read + write findings; FO: SELECT only (no logging);
-- admin full; citizen: project-level (parcel_id IS NULL) or own parcels
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS staff_read_audit ON public.audit_logs;
CREATE POLICY staff_read_audit ON public.audit_logs FOR SELECT
  USING (public.current_user_role() IN ('admin','auditor','field_officer'));

DROP POLICY IF EXISTS auditor_write_audit ON public.audit_logs;
CREATE POLICY auditor_write_audit ON public.audit_logs FOR ALL
  USING (public.current_user_role() IN ('admin','auditor'))
  WITH CHECK (public.current_user_role() IN ('admin','auditor'));

DROP POLICY IF EXISTS citizen_audit ON public.audit_logs;
CREATE POLICY citizen_audit ON public.audit_logs FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND (
    parcel_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = audit_logs.parcel_id
        AND p.owner_aadhaar = (SELECT aadhaar FROM public.user_profiles WHERE id = auth.uid())
    )
  )
);

-- ---------------------------------------------------------------------------
-- RISK ASSESSMENTS — staff read + write; citizen: own parcels
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS staff_risk ON public.risk_assessments;
CREATE POLICY staff_risk ON public.risk_assessments FOR ALL
  USING (public.current_user_role() IN ('admin','field_officer'))
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS auditor_read_risk ON public.risk_assessments;
CREATE POLICY auditor_read_risk ON public.risk_assessments FOR SELECT
  USING (public.current_user_role() IN ('admin','auditor'));

DROP POLICY IF EXISTS citizen_risk ON public.risk_assessments;
CREATE POLICY citizen_risk ON public.risk_assessments FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = risk_assessments.parcel_id
      AND p.owner_aadhaar = (SELECT aadhaar FROM public.user_profiles WHERE id = auth.uid())
  )
);

-- ===========================================================================
-- STORAGE BUCKETS — private; signed URLs minted by the app on display
-- ===========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-evidence', 'audit-evidence', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('hearing-minutes', 'hearing-minutes', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket policies: authenticated users can upload into all three;
-- reads go through signed URLs issued client-side (createSignedUrl),
-- which bypasses object policies but requires an authenticated session.
-- Drop legacy (004-era) and current policy names first — re-runnable.
DO $$ DECLARE p TEXT; BEGIN
  FOREACH p IN ARRAY ARRAY[
    -- current
    'auth read all buckets', 'auth write documents',
    -- 003_rls_hardening era
    '003_documents_read',
    '003_documents_upload',
    '003_documents_delete',
    '003_staff_buckets_read',
    '003_staff_buckets_upload',
    '003_staff_buckets_delete',
    -- 004_storage_buckets era
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

CREATE POLICY "auth read all buckets" ON storage.objects FOR SELECT
  USING (bucket_id IN ('documents','audit-evidence','hearing-minutes') AND auth.role() = 'authenticated');

CREATE POLICY "auth write documents" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('documents','audit-evidence','hearing-minutes') AND auth.role() = 'authenticated');

-- ===========================================================================
-- Done. Apply 002_seed.sql next.
-- ===========================================================================
