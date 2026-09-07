-- IGDTUW Storage Buckets — PROMPT 4
-- Create PRIVATE Supabase Storage buckets for document uploads (signed URLs for display)
-- Run in Supabase SQL Editor AFTER 001_initial_schema.sql
-- Idempotent: safe to re-run (drops+recreates policies, skips existing buckets)

-- Helper: create bucket if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'documents') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('documents', 'documents', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/tiff','image/webp']);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'audit-evidence') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('audit-evidence', 'audit-evidence', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/tiff']);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'hearing-minutes') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('hearing-minutes', 'hearing-minutes', false, 10485760, ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
  END IF;
END $$;

-- RLS Policies for documents bucket
-- Authenticated users can upload, everyone can read (public bucket)
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "Authenticated users can update their documents" ON storage.objects;
CREATE POLICY "Authenticated users can update their documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Authenticated users can delete their documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete their documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Public read access to documents" ON storage.objects;
CREATE POLICY "Authenticated read access to documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents');

-- RLS Policies for audit-evidence bucket
DROP POLICY IF EXISTS "Authenticated users can upload audit evidence" ON storage.objects;
CREATE POLICY "Authenticated users can upload audit evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'audit-evidence');

DROP POLICY IF EXISTS "Authenticated users can update their audit evidence" ON storage.objects;
CREATE POLICY "Authenticated users can update their audit evidence"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'audit-evidence' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Authenticated users can delete their audit evidence" ON storage.objects;
CREATE POLICY "Authenticated users can delete their audit evidence"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'audit-evidence' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Public read access to audit evidence" ON storage.objects;
CREATE POLICY "Authenticated read access to audit evidence"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'audit-evidence');

-- RLS Policies for hearing-minutes bucket
DROP POLICY IF EXISTS "Authenticated users can upload hearing minutes" ON storage.objects;
CREATE POLICY "Authenticated users can upload hearing minutes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hearing-minutes');

DROP POLICY IF EXISTS "Authenticated users can update their hearing minutes" ON storage.objects;
CREATE POLICY "Authenticated users can update their hearing minutes"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'hearing-minutes' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Authenticated users can delete their hearing minutes" ON storage.objects;
CREATE POLICY "Authenticated users can delete their hearing minutes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'hearing-minutes' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Public read access to hearing minutes" ON storage.objects;
CREATE POLICY "Authenticated read access to hearing minutes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'hearing-minutes');
