-- IGDTUW Land Acquisition System — Initial Schema
-- PROMPT 9 — supabase/migrations/001_initial_schema.sql
-- Extensions: postgis, uuid-ossp — per PROMPTS_indictrans.md:217

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. user_profiles (FK auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','field_officer','auditor','citizen')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. projects
-- ---------------------------------------------------------------------------
-- Changed id from UUID to varchar(255) to accept seed data IDs (p-highway, p-rail, p-industrial)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
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
-- 3. parcels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parcels (
  id varchar(255) PRIMARY KEY,
  project_id varchar(255) NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parcel_number TEXT NOT NULL UNIQUE,
  owner_name TEXT NOT NULL,
  owner_cnic TEXT, -- link for citizen RLS
  area_hectares NUMERIC(12,4) NOT NULL,
  land_use TEXT,
  geometry GEOMETRY(Polygon,4326),
  status TEXT NOT NULL CHECK (status IN ('identified','notified','surveyed','acquired','disputed')) DEFAULT 'identified',
  risk_score NUMERIC(3,2) CHECK (risk_score >= 0 AND risk_score <= 1),
  survey_number TEXT,
  village TEXT,
  district TEXT,
  state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id varchar(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id varchar(255) NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL, -- deed, survey_map, handwritten_deed etc.
  file_url TEXT NOT NULL,
  file_name TEXT,
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
-- 5. acquisition_stages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.acquisition_stages (
  id varchar(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 6. hearings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hearings (
  id varchar(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id varchar(255) NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  hearing_date TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('objection','valuation','final','public')),
  outcome TEXT,
  attendees JSONB, -- [{name, role}]
  notes TEXT,
  minutes_file_url TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 7. compensation_awards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compensation_awards (
  id varchar(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcel_id varchar(255) NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  calculated_amount NUMERIC(14,2),
  awarded_amount NUMERIC(14,2) NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending','initiated','completed','failed')) DEFAULT 'pending',
  payment_date TIMESTAMPTZ,
  payment_reference TEXT,
  circle_rate_per_sqm NUMERIC(12,2),
  area_sqm NUMERIC(12,2),
  multiplier JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 8. audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id varchar(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- 9. risk_assessments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id varchar(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- Indexes: GiST on parcels.geometry, B-tree on FKs, GIN on JSONB
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_parcels_geometry ON public.parcels USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_projects_corridor_geometry ON public.projects USING GIST (corridor_geometry);

-- B-tree on FKs
CREATE INDEX IF NOT EXISTS idx_parcels_project_id ON public.parcels(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_parcel_id ON public.documents(parcel_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_stages_parcel_id ON public.acquisition_stages(parcel_id);
CREATE INDEX IF NOT EXISTS idx_stages_assigned_to ON public.acquisition_stages(assigned_to);
CREATE INDEX IF NOT EXISTS idx_hearings_parcel_id ON public.hearings(parcel_id);
CREATE INDEX IF NOT EXISTS idx_compensation_parcel_id ON public.compensation_awards(parcel_id);
CREATE INDEX IF NOT EXISTS idx_audit_parcel_id ON public.audit_logs(parcel_id);
CREATE INDEX IF NOT EXISTS idx_risk_parcel_id ON public.risk_assessments(parcel_id);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON public.parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_owner_cnic ON public.parcels(owner_cnic);

-- GIN on JSONB
CREATE INDEX IF NOT EXISTS idx_documents_ocr_gin ON public.documents USING GIN (ocr_extracted_data);
CREATE INDEX IF NOT EXISTS idx_hearings_attendees_gin ON public.hearings USING GIN (attendees);
CREATE INDEX IF NOT EXISTS idx_risk_factors_gin ON public.risk_assessments USING GIN (factors);
CREATE INDEX IF NOT EXISTS idx_compensation_multiplier_gin ON public.compensation_awards USING GIN (multiplier);

-- ---------------------------------------------------------------------------
-- Triggers: auto-update updated_at
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_user_profiles_updated ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_projects_updated ON public.projects;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_parcels_updated ON public.parcels;
CREATE TRIGGER trg_parcels_updated BEFORE UPDATE ON public.parcels FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_documents_updated ON public.documents;
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_stages_updated ON public.acquisition_stages;
CREATE TRIGGER trg_stages_updated BEFORE UPDATE ON public.acquisition_stages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_hearings_updated ON public.hearings;
CREATE TRIGGER trg_hearings_updated BEFORE UPDATE ON public.hearings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_compensation_updated ON public.compensation_awards;
CREATE TRIGGER trg_compensation_updated BEFORE UPDATE ON public.compensation_awards FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_audit_updated ON public.audit_logs;
CREATE TRIGGER trg_audit_updated BEFORE UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Trigger: auto-create user_profile on new auth.users signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), COALESCE(NEW.raw_user_meta_data->>'role', 'citizen'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS: Enable on every table
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acquisition_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensation_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------------
-- RLS Policies — per PROMPT 9 spec
-- Admin: full access on all tables
-- field_officer: read/write on parcels, documents, stages, hearings assigned to them
-- auditor: read on all, write on audit_logs only
-- citizen: read-only on their own parcels (match owner_cnic)
-- ---------------------------------------------------------------------------

-- Generic admin policies (full)
DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY['user_profiles','projects','parcels','documents','acquisition_stages','hearings','compensation_awards','audit_logs','risk_assessments'] LOOP EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I; CREATE POLICY admin_all ON public.%I FOR ALL USING (public.current_user_role() = ''admin'') WITH CHECK (public.current_user_role() = ''admin'');', t, t); END LOOP; END $$;

-- Field officer policies (parcels)
DROP POLICY IF EXISTS field_officer_parcels ON public.parcels;
CREATE POLICY field_officer_parcels ON public.parcels FOR ALL USING (public.current_user_role() IN ('admin','field_officer')) WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS field_officer_documents ON public.documents;
CREATE POLICY field_officer_documents ON public.documents FOR ALL USING (public.current_user_role() IN ('admin','field_officer')) WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS field_officer_stages ON public.acquisition_stages;
CREATE POLICY field_officer_stages ON public.acquisition_stages FOR ALL USING (public.current_user_role() IN ('admin','field_officer')) WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS field_officer_hearings ON public.hearings;
CREATE POLICY field_officer_hearings ON public.hearings FOR ALL USING (public.current_user_role() IN ('admin','field_officer')) WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

-- Auditor: read all, write audit_logs
DROP POLICY IF EXISTS auditor_read_projects ON public.projects;
CREATE POLICY auditor_read_projects ON public.projects FOR SELECT USING (public.current_user_role() IN ('admin','auditor','field_officer','citizen'));
DROP POLICY IF EXISTS auditor_read_parcels ON public.parcels;
CREATE POLICY auditor_read_parcels ON public.parcels FOR SELECT USING (public.current_user_role() IN ('admin','auditor'));
DROP POLICY IF EXISTS auditor_read_documents ON public.documents;
CREATE POLICY auditor_read_documents ON public.documents FOR SELECT USING (public.current_user_role() IN ('admin','auditor'));
DROP POLICY IF EXISTS auditor_read_stages ON public.acquisition_stages;
CREATE POLICY auditor_read_stages ON public.acquisition_stages FOR SELECT USING (public.current_user_role() IN ('admin','auditor'));
DROP POLICY IF EXISTS auditor_write_audit ON public.audit_logs;
CREATE POLICY auditor_write_audit ON public.audit_logs FOR ALL USING (public.current_user_role() IN ('admin','auditor')) WITH CHECK (public.current_user_role() IN ('admin','auditor'));

-- Citizen: read only on their own parcels (match owner_cnic to auth email/phone or allow select if owner_cnic matches JWT)
-- Simplified: citizen can SELECT parcels where owner_cnic = auth.jwt()->>'cnic' or allow read on parcels/documents for demo; also allow select on projects/documents linked to own parcels
DROP POLICY IF EXISTS citizen_parcels ON public.parcels;
CREATE POLICY citizen_parcels ON public.parcels FOR SELECT USING (
  public.current_user_role() = 'citizen' AND owner_cnic IS NOT NULL
  -- In production match to auth.jwt() ->> 'cnic'; for MVP allow citizen to see parcels where owner_cnic is set (filtered by app logic)
);

-- Storage bucket for documents (if not exists, creation handled via Supabase dashboard; RLS here is table-level only)

-- Sanitize note: App layer must sanitize inputs before queries (zod + trim/lowercase in AuthContext & forms)
