-- Migration 003: RLS fixes, indexes, created_by triggers, CNIC support
-- Addresses: audit issues 1-30 — security, data integrity, performance

-- =========================================================================
-- 1. SCHEMA CHANGES
-- =========================================================================

-- 1a. Add CNIC to user_profiles (for citizen ownership matching)
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS cnic TEXT;
CREATE INDEX IF NOT EXISTS idx_user_profiles_cnic ON public.user_profiles(cnic);

-- 1b. Add created_by to tables missing it (field officer scoping)
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.compensation_awards ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 1c. Add file_size to documents (was missing from schema)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- =========================================================================
-- 2. INDEXES (missing FK indexes + role index for RLS perf)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_parcels_created_by ON public.parcels(created_by);
CREATE INDEX IF NOT EXISTS idx_compensation_created_by ON public.compensation_awards(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_verified_by ON public.documents(verified_by);
CREATE INDEX IF NOT EXISTS idx_hearings_created_by ON public.hearings(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_by ON public.audit_logs(created_by);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_assessed_by ON public.risk_assessments(assessed_by);

-- =========================================================================
-- 3. AUTO-FILL created_by TRIGGER (server-side, can't be bypassed)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Parcels
DROP TRIGGER IF EXISTS trg_set_created_by ON public.parcels;
CREATE TRIGGER trg_set_created_by
  BEFORE INSERT ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- Documents (uses uploaded_by, but also set created_by if present)
DROP TRIGGER IF EXISTS trg_set_created_by ON public.documents;
CREATE TRIGGER trg_set_created_by
  BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- Hearings
DROP TRIGGER IF EXISTS trg_set_created_by ON public.hearings;
CREATE TRIGGER trg_set_created_by
  BEFORE INSERT ON public.hearings
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- Compensation awards
DROP TRIGGER IF EXISTS trg_set_created_by ON public.compensation_awards;
CREATE TRIGGER trg_set_created_by
  BEFORE INSERT ON public.compensation_awards
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- Audit logs
DROP TRIGGER IF EXISTS trg_set_created_by ON public.audit_logs;
CREATE TRIGGER trg_set_created_by
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- Risk assessments (uses assessed_by, set created_by too if present)
DROP TRIGGER IF EXISTS trg_set_created_by ON public.risk_assessments;
CREATE TRIGGER trg_set_created_by
  BEFORE INSERT ON public.risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- =========================================================================
-- 4. GUARD handle_new_user() — always defaults to citizen, ignores metadata role
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role, cnic)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'citizen',
    NULLIF(NEW.raw_user_meta_data->>'cnic', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- 5. RLS POLICY FIXES
-- =========================================================================

-- 5a. Drop broad citizen policies (will re-add with CNIC filter in Phase 3)
DROP POLICY IF EXISTS citizen_hearings ON public.hearings;
DROP POLICY IF EXISTS citizen_documents ON public.documents;
DROP POLICY IF EXISTS citizen_compensation ON public.compensation_awards;
DROP POLICY IF EXISTS citizen_audit ON public.audit_logs;
DROP POLICY IF EXISTS citizen_risk ON public.risk_assessments;
DROP POLICY IF EXISTS citizen_stages ON public.acquisition_stages;
-- Keep citizen_parcels from 001 (has owner_cnic check, re-add with CNIC filter later)

-- 5b. Narrow field officer policies — scope to created_by/uploaded_by/assigned_to
-- Parcels: created_by
DROP POLICY IF EXISTS field_officer_parcels ON public.parcels;
CREATE POLICY field_officer_parcels ON public.parcels
  FOR ALL
  USING (public.current_user_role() IN ('admin','field_officer') AND (created_by = auth.uid() OR public.current_user_role() = 'admin'))
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

-- Documents: uploaded_by
DROP POLICY IF EXISTS field_officer_documents ON public.documents;
CREATE POLICY field_officer_documents ON public.documents
  FOR ALL
  USING (public.current_user_role() IN ('admin','field_officer') AND (uploaded_by = auth.uid() OR public.current_user_role() = 'admin'))
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

-- Stages: assigned_to (stages are system-created, officers advance assigned ones)
DROP POLICY IF EXISTS field_officer_stages ON public.acquisition_stages;
CREATE POLICY field_officer_stages ON public.acquisition_stages
  FOR ALL
  USING (public.current_user_role() IN ('admin','field_officer') AND (assigned_to = auth.uid() OR public.current_user_role() = 'admin'))
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

-- Hearings: created_by
DROP POLICY IF EXISTS field_officer_hearings ON public.hearings;
CREATE POLICY field_officer_hearings ON public.hearings
  FOR ALL
  USING (public.current_user_role() IN ('admin','field_officer') AND (created_by = auth.uid() OR public.current_user_role() = 'admin'))
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

-- Compensation: created_by (new column)
DROP POLICY IF EXISTS field_officer_compensation ON public.compensation_awards;
CREATE POLICY field_officer_compensation ON public.compensation_awards
  FOR ALL
  USING (public.current_user_role() IN ('admin','field_officer') AND (created_by = auth.uid() OR public.current_user_role() = 'admin'))
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

-- 5c. Auditor SELECT policies (missing from 001)
DROP POLICY IF EXISTS auditor_read_hearings ON public.hearings;
CREATE POLICY auditor_read_hearings ON public.hearings
  FOR SELECT USING (public.current_user_role() IN ('admin','auditor'));

DROP POLICY IF EXISTS auditor_read_compensation ON public.compensation_awards;
CREATE POLICY auditor_read_compensation ON public.compensation_awards
  FOR SELECT USING (public.current_user_role() IN ('admin','auditor'));

DROP POLICY IF EXISTS auditor_read_risk ON public.risk_assessments;
CREATE POLICY auditor_read_risk ON public.risk_assessments
  FOR SELECT USING (public.current_user_role() IN ('admin','auditor'));

-- Staff can read user_profiles (to resolve created_by/uploaded_by UUIDs to names)
DROP POLICY IF EXISTS staff_read_profiles ON public.user_profiles;
CREATE POLICY staff_read_profiles ON public.user_profiles
  FOR SELECT USING (public.current_user_role() IN ('admin','auditor','field_officer'));

-- 5d. Field officer read for compensation/risk/audit (need to see data for their parcels)
DROP POLICY IF EXISTS field_officer_read_compensation ON public.compensation_awards;
CREATE POLICY field_officer_read_compensation ON public.compensation_awards
  FOR SELECT USING (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS field_officer_read_risk ON public.risk_assessments;
CREATE POLICY field_officer_read_risk ON public.risk_assessments
  FOR SELECT USING (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS field_officer_read_audit ON public.audit_logs;
CREATE POLICY field_officer_read_audit ON public.audit_logs
  FOR SELECT USING (public.current_user_role() IN ('admin','field_officer'));

-- 5e. Self-service profile policy (from 002, ensure it exists)
DROP POLICY IF EXISTS user_self_profile ON public.user_profiles;
CREATE POLICY user_self_profile ON public.user_profiles
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- =========================================================================
-- 6. CITIZEN RLS — scoped by owner_cnic matching user_profiles.cnic
-- =========================================================================
-- Citizens can only see data for parcels they own (owner_cnic = their cnic)

-- Parcels: match owner_cnic to citizen's profile cnic
DROP POLICY IF EXISTS citizen_parcels ON public.parcels;
CREATE POLICY citizen_parcels ON public.parcels FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND owner_cnic IS NOT NULL
  AND owner_cnic = (SELECT cnic FROM public.user_profiles WHERE id = auth.uid())
);

-- Documents: only for own parcels
DROP POLICY IF EXISTS citizen_documents ON public.documents;
CREATE POLICY citizen_documents ON public.documents FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = documents.parcel_id
    AND p.owner_cnic = (SELECT cnic FROM public.user_profiles WHERE id = auth.uid())
  )
);

-- Hearings: only for own parcels
DROP POLICY IF EXISTS citizen_hearings ON public.hearings;
CREATE POLICY citizen_hearings ON public.hearings FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = hearings.parcel_id
    AND p.owner_cnic = (SELECT cnic FROM public.user_profiles WHERE id = auth.uid())
  )
);

-- Stages: only for own parcels
DROP POLICY IF EXISTS citizen_stages ON public.acquisition_stages;
CREATE POLICY citizen_stages ON public.acquisition_stages FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = acquisition_stages.parcel_id
    AND p.owner_cnic = (SELECT cnic FROM public.user_profiles WHERE id = auth.uid())
  )
);

-- Compensation: only for own parcels
DROP POLICY IF EXISTS citizen_compensation ON public.compensation_awards;
CREATE POLICY citizen_compensation ON public.compensation_awards FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = compensation_awards.parcel_id
    AND p.owner_cnic = (SELECT cnic FROM public.user_profiles WHERE id = auth.uid())
  )
);

-- Audit: project-level (parcel_id IS NULL) visible to all citizens, parcel-level only for own
DROP POLICY IF EXISTS citizen_audit ON public.audit_logs;
CREATE POLICY citizen_audit ON public.audit_logs FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND (
    parcel_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.parcels p
      WHERE p.id = audit_logs.parcel_id
      AND p.owner_cnic = (SELECT cnic FROM public.user_profiles WHERE id = auth.uid())
    )
  )
);

-- Risk: only for own parcels
DROP POLICY IF EXISTS citizen_risk ON public.risk_assessments;
CREATE POLICY citizen_risk ON public.risk_assessments FOR SELECT USING (
  public.current_user_role() = 'citizen'
  AND EXISTS (
    SELECT 1 FROM public.parcels p
    WHERE p.id = risk_assessments.parcel_id
    AND p.owner_cnic = (SELECT cnic FROM public.user_profiles WHERE id = auth.uid())
  )
);
