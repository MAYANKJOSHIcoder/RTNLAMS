-- Migration 006: documents uploaded_by trigger + field-officer RLS relaxation
-- Fixes: field officers saw an empty app (seed rows have created_by/uploaded_by/assigned_to NULL,
-- and 003 scoped officer policies to those columns). Officers work on shared project data,
-- so policies are now role-based.

-- =========================================================================
-- 1. documents: stamp uploader automatically (003 triggers covered parcels/
--    hearings/compensation/audit but not documents)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_uploaded_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.uploaded_by IS NULL THEN
    NEW.uploaded_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_uploaded_by ON public.documents;
CREATE TRIGGER trg_set_uploaded_by
  BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_uploaded_by();

-- =========================================================================
-- 2. Field-officer policies: role-based (drop created_by/uploaded_by/assigned_to match)
-- =========================================================================
DROP POLICY IF EXISTS field_officer_parcels ON public.parcels;
CREATE POLICY field_officer_parcels ON public.parcels
  FOR ALL
  USING (public.current_user_role() IN ('admin','field_officer'))
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS field_officer_documents ON public.documents;
CREATE POLICY field_officer_documents ON public.documents
  FOR ALL
  USING (public.current_user_role() IN ('admin','field_officer'))
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS field_officer_stages ON public.acquisition_stages;
CREATE POLICY field_officer_stages ON public.acquisition_stages
  FOR ALL
  USING (public.current_user_role() IN ('admin','field_officer'))
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS field_officer_hearings ON public.hearings;
CREATE POLICY field_officer_hearings ON public.hearings
  FOR ALL
  USING (public.current_user_role() IN ('admin','field_officer'))
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));

DROP POLICY IF EXISTS field_officer_compensation ON public.compensation_awards;
CREATE POLICY field_officer_compensation ON public.compensation_awards
  FOR ALL
  USING (public.current_user_role() IN ('admin','field_officer'))
  WITH CHECK (public.current_user_role() IN ('admin','field_officer'));
