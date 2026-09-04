-- IGDTUW Storage Buckets — PROMPT 4
-- Create Supabase Storage buckets for document uploads
-- Run in Supabase SQL Editor AFTER 001_initial_schema.sql

-- Helper: create bucket if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'documents') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('documents', 'documents', true, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/tiff','image/webp']);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'audit-evidence') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('audit-evidence', 'audit-evidence', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/tiff']);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'hearing-minutes') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('hearing-minutes', 'hearing-minutes', true, 10485760, ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
  END IF;
END $$;

-- RLS Policies for documents bucket
-- Authenticated users can upload, everyone can read (public bucket)
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated users can update their documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND auth.uid() = owner);

CREATE POLICY "Authenticated users can delete their documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND auth.uid() = owner);

CREATE POLICY "Public read access to documents"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'documents');

-- RLS Policies for audit-evidence bucket
CREATE POLICY "Authenticated users can upload audit evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'audit-evidence');

CREATE POLICY "Authenticated users can update their audit evidence"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'audit-evidence' AND auth.uid() = owner);

CREATE POLICY "Authenticated users can delete their audit evidence"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'audit-evidence' AND auth.uid() = owner);

CREATE POLICY "Public read access to audit evidence"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'audit-evidence');

-- RLS Policies for hearing-minutes bucket
CREATE POLICY "Authenticated users can upload hearing minutes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hearing-minutes');

CREATE POLICY "Authenticated users can update their hearing minutes"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'hearing-minutes' AND auth.uid() = owner);

CREATE POLICY "Authenticated users can delete their hearing minutes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'hearing-minutes' AND auth.uid() = owner);

CREATE POLICY "Public read access to hearing minutes"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'hearing-minutes');