import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../ui/Button';
import { useCreateAudit } from '../../hooks/useAudit';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import type { AuditLog } from '../../lib/types';
import toast from 'react-hot-toast';

interface AuditFormProps {
  parcelId?: string | null;
  onSuccess?: () => void;
}

export default function AuditForm({ parcelId, onSuccess }: AuditFormProps) {
  const [auditType, setAuditType] = useState<AuditLog['audit_type']>('field');
  const [finding, setFinding] = useState('');
  const [severity, setSeverity] = useState<AuditLog['severity']>('medium');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [resolved, setResolved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const create = useCreateAudit();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let image_url: string | null = null;
    if (imageFile) {
      if (!isSupabaseConfigured()) {
        toast.error('Supabase not configured — fill .env');
        return;
      }
      setUploading(true);
      const sanitizedName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `audit/${Date.now()}-${sanitizedName}`;
      const { error: upErr } = await supabase.storage.from('audit-evidence').upload(path, imageFile, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`);
        setUploading(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from('audit-evidence').getPublicUrl(path);
      image_url = publicUrl;
      setUploading(false);
    }

    create.mutate(
      {
        parcel_id: parcelId ?? null,
        audit_type: auditType,
        finding,
        severity,
        image_url,
        resolved,
      },
      {
        onSuccess: () => {
          setFinding('');
          setImageFile(null);
          setResolved(false);
          onSuccess?.();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Audit type</label>
          <select
            value={auditType}
            onChange={(e) => setAuditType(e.target.value as AuditLog['audit_type'])}
            className="w-full h-11 px-3 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0369A1] cursor-pointer"
          >
            <option value="satellite">Satellite</option>
            <option value="field">Field</option>
            <option value="compliance">Compliance</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as AuditLog['severity'])}
            className="w-full h-11 px-3 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0369A1] cursor-pointer"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="parcelId" className="block text-sm font-medium text-slate-700 mb-1">
          Parcel (optional)
        </label>
        <input
          id="parcelId"
          value={parcelId ?? ''}
          disabled
          placeholder="Link to parcel (auto from selection)"
          className="w-full h-11 px-3 border border-slate-300 rounded-md text-sm bg-slate-50 text-slate-500"
        />
      </div>

      <div>
        <label htmlFor="finding" className="block text-sm font-medium text-slate-700 mb-1">
          Finding <span className="text-red-600">*</span>
        </label>
        <textarea
          id="finding"
          required
          value={finding}
          onChange={(e) => setFinding(e.target.value)}
          placeholder="Describe finding… e.g., encroachment detected via satellite"
          className="w-full min-h-20 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Evidence image</label>
        <label className="flex items-center gap-2 h-11 px-3 border border-dashed border-slate-300 rounded-md text-sm cursor-pointer hover:bg-slate-50">
          <Upload size={16} /> {imageFile ? imageFile.name : 'Click to upload evidence'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={resolved} onChange={(e) => setResolved(e.target.checked)} className="rounded" />
        Resolved
      </label>

      <Button type="submit" loading={create.isPending || uploading} className="w-full">
        Log Audit
      </Button>
      {create.isError && <p className="text-xs text-red-600">{(create.error as Error).message}</p>}
    </form>
  );
}
