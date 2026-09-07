import { useEffect, useState } from 'react';
import { FileText, Globe, CheckCircle, Clock, Download, RefreshCw, ThumbsUp, ThumbsDown, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { Badge, statusToBadgeVariant } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { useUpdateDocument } from '../../hooks/useDocuments';
import { useRecalcRiskForParcel } from '../../hooks/useRisk';
import { useGeminiExtraction } from '../../hooks/useGemini';
import { getSignedUrl, downloadObject } from '../../lib/supabase/storage';
import type { Document as DocType } from '../../lib/types';
import type { PromptType } from '../../lib/gemini/prompts';

interface DocumentDetailProps {
  document: DocType | null;
  onClose: () => void;
}

const REEXTRACT_TYPES: { value: PromptType; label: string }[] = [
  { value: 'deed', label: 'Deed' },
  { value: 'survey_map', label: 'Survey Map' },
  { value: 'handwritten_deed', label: 'Handwritten Deed' },
];

function confidenceBadge(conf?: number | null) {
  if (conf == null) return null;
  const cls =
    conf > 0.8
      ? 'bg-green-50 border-green-200 text-green-700'
      : conf >= 0.5
        ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
        : 'bg-red-50 border-red-200 text-red-700';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] border shrink-0 ${cls}`} title={`Field confidence: ${Math.round(conf * 100)}%`}>
      {Math.round(conf * 100)}%
    </span>
  );
}

export default function DocumentDetail({ document, onClose }: DocumentDetailProps) {
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [perFieldConf, setPerFieldConf] = useState<Record<string, number>>({});
  const [reextractType, setReextractType] = useState<PromptType>('deed');
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const update = useUpdateDocument();
  const recalcRisk = useRecalcRiskForParcel();
  const extract = useGeminiExtraction();

  useEffect(() => {
    if (!document?.ocr_extracted_data) {
      setExtracted(null);
      setFields({});
      setPerFieldConf({});
      return;
    }
    const data = document.ocr_extracted_data as Record<string, unknown>;
    setExtracted(data);
    setFields(Object.fromEntries(Object.entries((data.extracted_fields as Record<string, unknown>) ?? {}).map(([k, v]) => [k, String(v ?? '')])));
    setPerFieldConf((data.confidence_per_field as Record<string, number>) ?? {});
  }, [document?.id, document?.status, document?.ocr_extracted_data]);

  // Mint a short-lived signed URL for the private-bucket preview
  useEffect(() => {
    let cancelled = false;
    setSignedUrl(null);
    if (document?.file_url) {
      getSignedUrl('documents', document.file_url).then((u) => {
        if (!cancelled) setSignedUrl(u);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [document?.id, document?.file_url]);

  const handleDownload = async () => {
    if (!document?.file_url) return;
    setLoading(true);
    try {
      const blob = await downloadObject('documents', document.file_url);
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name || `document-${document.id}.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
    } catch {
      alert('Failed to download document');
    } finally {
      setLoading(false);
    }
  };

  const setStatus = (status: 'verified' | 'flagged') => {
    if (!document) return;
    const pid = document.parcel_id;
    update.mutate(
      { id: document.id, status },
      { onSuccess: () => recalcRisk.mutate(pid) },
    );
  };

  const saveEdits = () => {
    if (!document) return;
    const data = (document.ocr_extracted_data ?? {}) as Record<string, unknown>;
    update.mutate({
      id: document.id,
      ocr_extracted_data: { ...data, extracted_fields: fields } as Record<string, unknown>,
      status: 'extracted',
    });
  };

  const handleReextract = async () => {
    if (!document?.file_url) return;
    try {
      const blob = await downloadObject('documents', document.file_url);
      const file = new File([blob], document.file_name ?? 'document.pdf', { type: blob.type || 'application/pdf' });
      extract.mutate({ file, promptType: reextractType, documentId: document.id });
    } catch {
      toast.error('Failed to fetch document file for re-extraction');
    }
  };

  if (!document) return null;

  const overallConf = document.ocr_confidence;

  return (
    <Modal open={true} onClose={onClose} title="OCR Review">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <FileText size={14} />
              <span>{document.file_name ?? document.doc_type}</span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-sm text-slate-600">
              <span>Parcel: <code className="bg-slate-100 px-1.5 rounded">{document.parcel_id}</code></span>
              <span>Language: {document.language ?? '-'}</span>
              <span>Size: {document.file_size ? `${(document.file_size / 1024).toFixed(1)} KB` : '-'}</span>
            </div>
          </div>
          <Badge variant={statusToBadgeVariant(document.status)} className="text-sm">
            {document.status}
          </Badge>
        </div>

        {/* Split view: preview left, extracted editor right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: file preview */}
          <div>
            <h4 className="font-medium text-slate-900 mb-2 text-sm">Preview</h4>
            {document.file_url ? (
              signedUrl ? (
                <iframe src={signedUrl} title="Document preview" className="w-full h-[420px] rounded-lg border border-slate-200 bg-white" />
              ) : (
                <div className="h-[420px] flex items-center justify-center text-sm text-slate-400 border border-slate-200 rounded-lg">Loading preview…</div>
              )
            ) : (
              <div className="h-[420px] flex items-center justify-center text-sm text-slate-400 border border-slate-200 rounded-lg">No file available</div>
            )}
          </div>

          {/* Right: extracted fields editor with per-field confidence */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-slate-900 text-sm flex items-center gap-1">
                <CheckCircle size={14} className="text-green-600" /> Extracted Fields
              </h4>
              {overallConf != null && confidenceBadge(overallConf)}
            </div>
            {extracted?.extracted_fields && Object.keys(fields).length > 0 ? (
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {Object.entries(fields).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <label htmlFor={`f-${key}`} className="w-32 shrink-0 text-xs text-slate-500 truncate" title={key}>
                      {key.replace(/_/g, ' ')}
                    </label>
                    <input
                      id={`f-${key}`}
                      value={value}
                      onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
                      className="flex-1 min-w-0 h-8 px-2 border border-slate-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
                    />
                    {confidenceBadge(perFieldConf[key] ?? perFieldConf[key.replace(/_/g, ' ')] ?? null)}
                  </div>
                ))}
                <div className="flex justify-end pt-2">
                  <Button size="sm" variant="secondary" onClick={saveEdits} loading={update.isPending} leftIcon={<Save size={14} />}>
                    Save Edits
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-[420px] flex flex-col items-center justify-center text-center text-sm text-slate-400 border border-slate-200 rounded-lg px-4">
                <Clock size={28} className="mb-2 text-slate-300" />
                <p>No extracted data available. Document may still be processing — use Re-extract.</p>
              </div>
            )}
          </div>
        </div>

        {document.translated_text && (
          <div className="border border-slate-200 rounded-lg p-4 bg-blue-50">
            <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
              <Globe size={16} className="text-blue-600" /> Translated Text
            </h4>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{document.translated_text}</p>
          </div>
        )}

        {document.ocr_raw_text && (
          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
              <FileText size={16} className="text-slate-600" /> Raw OCR Text
            </h4>
            <p className="text-sm text-slate-600 whitespace-pre-wrap max-h-60 overflow-auto">
              {document.ocr_raw_text}
            </p>
          </div>
        )}

        {/* Actions: re-extract, verify/reject, download */}
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-1">
            <select
              value={reextractType}
              onChange={(e) => setReextractType(e.target.value as PromptType)}
              className="h-10 px-2 border border-slate-300 rounded-md text-sm bg-white cursor-pointer"
              aria-label="Re-extract document type"
            >
              {REEXTRACT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <Button variant="secondary" onClick={handleReextract} loading={extract.isPending} leftIcon={<RefreshCw size={14} />}>
              Re-extract
            </Button>
          </div>
          <span className="flex-1" />
          <Button variant="danger" onClick={() => setStatus('flagged')} loading={update.isPending} leftIcon={<ThumbsDown size={14} />}>
            Reject
          </Button>
          <Button onClick={() => setStatus('verified')} loading={update.isPending} leftIcon={<ThumbsUp size={14} />}>
            Verify
          </Button>
          <Button variant="secondary" onClick={handleDownload} loading={loading} leftIcon={<Download size={16} />}>
            Download
          </Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
