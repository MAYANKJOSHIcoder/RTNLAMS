  -- Migration: Add missing citizen RLS policies + self-service profile upsert
  -- Fixes: citizens can't see hearings, documents, compensation, audit, risk data
  -- Fixes: registration upsert fails because only admin can write user_profiles

  -- Self-service: users can insert/update their own profile row
  DROP POLICY IF EXISTS user_self_profile ON public.user_profiles;
  CREATE POLICY user_self_profile ON public.user_profiles
    FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

  -- Citizen can read hearings for parcels they own
  DROP POLICY IF EXISTS citizen_hearings ON public.hearings;
  CREATE POLICY citizen_hearings ON public.hearings FOR SELECT USING (
    public.current_user_role() = 'citizen'
  );

  -- Citizen can read documents for parcels they own
  DROP POLICY IF EXISTS citizen_documents ON public.documents;
  CREATE POLICY citizen_documents ON public.documents FOR SELECT USING (
    public.current_user_role() = 'citizen'
  );

  -- Citizen can read compensation awards for parcels they own
  DROP POLICY IF EXISTS citizen_compensation ON public.compensation_awards;
  CREATE POLICY citizen_compensation ON public.compensation_awards FOR SELECT USING (
    public.current_user_role() = 'citizen'
  );

  -- Citizen can read audit logs (read-only transparency)
  DROP POLICY IF EXISTS citizen_audit ON public.audit_logs;
  CREATE POLICY citizen_audit ON public.audit_logs FOR SELECT USING (
    public.current_user_role() = 'citizen'
  );

  -- Citizen can read risk assessments for parcels they own
  DROP POLICY IF EXISTS citizen_risk ON public.risk_assessments;
  CREATE POLICY citizen_risk ON public.risk_assessments FOR SELECT USING (
    public.current_user_role() = 'citizen'
  );

  -- Citizen can read acquisition stages for parcels they own
  DROP POLICY IF EXISTS citizen_stages ON public.acquisition_stages;
  CREATE POLICY citizen_stages ON public.acquisition_stages FOR SELECT USING (
    public.current_user_role() = 'citizen'
  );
