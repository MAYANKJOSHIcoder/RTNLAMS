import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import type { Document } from '../lib/types';
import toast from 'react-hot-toast';

const BUCKET = 'documents';
const MAX_MB = 10;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/webp'];

function validateFile(file: File): string | null {
  if (file.size > MAX_MB * 1024 * 1024) return `File exceeds ${MAX_MB}MB limit`;
  if (!ALLOWED.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png|tiff|tif)$/i)) return 'Unsupported file type (PDF/JPG/PNG/TIFF only)';
  return null;
}

export function useDocuments(parcelId?: string) {
  return useQuery({
    queryKey: ['documents', parcelId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return [] as Document[];
      let q = supabase.from('documents').select('*').order('created_at', { ascending: false });
      if (parcelId) q = q.eq('parcel_id', parcelId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Document[];
    },
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      parcelId,
      docType = 'deed',
      language = 'en',
    }: {
      file: File;
      parcelId: string;
      docType?: string;
      language?: string;
    }) => {
      const v = validateFile(file);
      if (v) throw new Error(v);
      const pid = String(parcelId ?? '').trim();
      if (!pid) throw new Error('parcelId required');
      if (!isSupabaseConfigured()) throw new Error('Database not connected');

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${pid}/${Date.now()}-${sanitizedName}`;

      // Private bucket: store the storage PATH in file_url — signed URLs are minted on display

      // Upload to Supabase Storage
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw new Error(upErr.message);

      // Create document record
      const { data, error } = await supabase
        .from('documents')
        .insert({
          parcel_id: pid,
          doc_type: String(docType ?? '').trim() || 'deed',
          file_url: path,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          language: String(language ?? '').trim() || 'en',
          status: 'uploaded',
          ocr_extracted_data: null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Document;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['documents', vars.parcelId] });
      toast.success('Document uploaded');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Document> & { id: string }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      const { data, error } = await supabase.from('documents').update(patch).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data as Document;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['documents', d.parcel_id] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, parcelId }: { id: string; parcelId?: string }) => {
      if (!isSupabaseConfigured()) throw new Error('Database not connected');
      // Best-effort bucket cleanup first — row delete must not be blocked by storage RLS
      const { data: row } = await supabase.from('documents').select('file_url').eq('id', id).single();
      if (row?.file_url) {
        // Rows store the storage path; legacy rows may hold a full public URL
        const p = row.file_url.includes('/object/') ? row.file_url.split('/object/public/')[1]?.replace(/^documents\//, '') : row.file_url.replace(/^documents\//, '');
        if (p) {
          const { error: rmErr } = await supabase.storage.from(BUCKET).remove([p]);
          if (rmErr) console.warn('[documents] bucket file not removed (RLS or already gone):', rmErr.message);
        }
      }
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return parcelId;
    },
    onSuccess: (parcelId) => {
      qc.invalidateQueries({ queryKey: ['documents', parcelId] });
      toast.success('Document deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
