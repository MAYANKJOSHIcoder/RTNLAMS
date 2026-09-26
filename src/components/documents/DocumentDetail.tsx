import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  FileText, Globe, CheckCircle, Clock, Copy, Download, ExternalLink, FileWarning,
  PencilLine, RefreshCw, Save, ThumbsDown, ThumbsUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { Badge, statusToBadgeVariant } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { useUpdateDocument } from '../../hooks/useDocuments';
import { useRecalcRiskForParcel } from '../../hooks/useRisk';
import { useParcels } from '../../hooks/useParcels';
import { useGeminiExtraction } from '../../hooks/useGemini';
import { getSignedUrl, downloadObject } from '../../lib/supabase/storage';
import { describePipeline, type PipelineReport } from '../../lib/gemini/pipeline';
import type { Document as DocType, Parcel } from '../../lib/types';
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

// ---------------------------------------------------------------------------
// Field-key helpers.
// Gemini is not consistent about key style ("land_area" / "land area" /
// "Land Area"), so confidence lookups go through a normalised key — the old
// `perFieldConf[key] ?? perFieldConf[key.replace(/_/g,' ')]` silently dropped
// the badge for every other spelling.
// ---------------------------------------------------------------------------
function normKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function prettyKey(key: string): string {
  const spaced = key.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Keys may contain spaces — never put the raw key in a DOM id. */
function fieldId(key: string): string {
  return `doc-field-${normKey(key) || 'value'}`;
}

/** Numbers/dates read better in mono; owner names in an Indic script do not. */
const NUMERIC_FIELD = /(area|amount|number|date|dimension|survey|registration|stamp|duty|latitude|longitude|lat|lng)/i;

const TONE_CLASS = {
  high: 'bg-green-50 border-green-200 text-green-700',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  low: 'bg-red-50 border-red-200 text-red-700',
} as const;

function confidenceTone(conf: number): keyof typeof TONE_CLASS {
  return conf > 0.8 ? 'high' : conf >= 0.5 ? 'medium' : 'low';
}

function confidenceBadge(conf?: number | null, edited = false) {
  if (conf == null) return null;
  const pct = Math.round(conf * 100);
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[11px] border shrink-0 tabnum ${TONE_CLASS[confidenceTone(conf)]}`}
      title={
        edited
          ? `OCR confidence ${pct}% — the value below was edited by you; this score describes the original extraction`
          : `OCR confidence: ${pct}%`
      }
    >
      {pct}%
    </span>
  );
}

/** Makes the 80 / 50 thresholds explicit instead of colour-only chips. */
function ConfidenceLegend() {
  const tones: [keyof typeof TONE_CLASS, string][] = [
    ['high', '≥80% trust'],
    ['medium', '50–79% review'],
    ['low', '<50% verify'],
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
      <span className="mr-0.5">OCR confidence:</span>
      {tones.map(([tone, label]) => (
        <span key={tone} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${TONE_CLASS[tone]}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

function MetaItem({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm text-slate-800 truncate" title={title}>{children}</div>
    </div>
  );
}

function formatSize(bytes?: number | null): string {
  if (!bytes) return '-';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
}

export default function DocumentDetail({ document, onClose }: DocumentDetailProps) {
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  /** Snapshot of the values as loaded — drives the dirty / edited diff. */
  const [originalFields, setOriginalFields] = useState<Record<string, string>>({});
  const [perFieldConf, setPerFieldConf] = useState<Record<string, number>>({});
  const [reextractType, setReextractType] = useState<PromptType>('deed');
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [copied, setCopied] = useState<'translated' | 'raw' | null>(null);
  const update = useUpdateDocument();
  const recalcRisk = useRecalcRiskForParcel();
  const extract = useGeminiExtraction();

  // Header shows parcel_number — owner instead of a raw UUID. Same query key as
  // the Parcels/Documents pages, so this is a cache read, not an extra request.
  const { data: parcelsData = [] } = useParcels(null, undefined);
  const parcel = useMemo(
    () => (parcelsData as Parcel[]).find((p) => p.id === document?.parcel_id) ?? null,
    [parcelsData, document?.parcel_id],
  );

  /** Confidence keyed by normalised field name, so any Gemini key style resolves. */
  const confByKey = useMemo(() => {
    const map: Record<string, number> = {};
    Object.entries(perFieldConf).forEach(([k, v]) => {
      if (typeof v === 'number' && Number.isFinite(v)) map[normKey(k)] = v;
    });
    return map;
  }, [perFieldConf]);

  const editedKeys = useMemo(
    () => new Set(Object.keys(fields).filter((k) => fields[k] !== (originalFields[k] ?? ''))),
    [fields, originalFields],
  );
  const isDirty = editedKeys.size > 0;

  // Provenance written by useGemini (ocr_extracted_data.pipeline). Absent on
  // documents extracted before this existed — the UI says so instead of lying.
  const pipeline = useMemo(
    () => ((extracted?.pipeline as PipelineReport | undefined) ?? null),
    [extracted],
  );
  const pipelineText = useMemo(() => (pipeline ? describePipeline(pipeline) : null), [pipeline]);

  useEffect(() => {
    if (!document?.ocr_extracted_data) {
      setExtracted(null);
      setFields({});
      setOriginalFields({});
      setPerFieldConf({});
      return;
    }
    const data = document.ocr_extracted_data as Record<string, unknown>;
    setExtracted(data);
    const next = Object.fromEntries(
      Object.entries((data.extracted_fields as Record<string, unknown>) ?? {}).map(([k, v]) => [k, String(v ?? '')]),
    );
    setFields(next);
    setOriginalFields(next);
    setPerFieldConf((data.confidence_per_field as Record<string, number>) ?? {});
  }, [document?.id, document?.status, document?.ocr_extracted_data]);

  // Mint a short-lived signed URL for the private-bucket preview.
  // A failure must be visible: the old code left signedUrl null forever and the
  // pane just said "Loading preview…" (the empty box in production).
  useEffect(() => {
    let cancelled = false;
    setSignedUrl(null);
    setPreviewState('loading');
    if (document?.file_url) {
      getSignedUrl('documents', document.file_url)
        .then((u) => {
          if (cancelled) return;
          setSignedUrl(u);
          setPreviewState(u ? 'ready' : 'error');
        })
        .catch(() => {
          if (!cancelled) setPreviewState('error');
        });
    } else {
      setPreviewState('error');
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
    } catch (e) {
      toast.error(`Download failed: ${(e as Error).message}`);
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

  // Writes only the edited field values. `status` is deliberately NOT touched:
  // fixing a typo must never silently un-verify a document — the status badge is
  // the record of a human decision, and only Verify/Reject may change it.
  const saveEdits = () => {
    if (!document) return;
    const data = (document.ocr_extracted_data ?? {}) as Record<string, unknown>;
    update.mutate(
      {
        id: document.id,
        ocr_extracted_data: { ...data, extracted_fields: fields } as Record<string, unknown>,
      },
      { onSuccess: () => setOriginalFields(fields) },
    );
  };

  const copyText = async (text: string, which: 'translated' | 'raw') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Clipboard not available in this browser');
    }
  };

  const handleReextract = async () => {
    if (!document?.file_url) return;
    try {
      const blob = await downloadObject('documents', document.file_url);
      const file = new File([blob], document.file_name ?? 'document.pdf', { type: blob.type || 'application/pdf' });
      extract.mutate({ file, promptType: reextractType, documentId: document.id, language: document.language ?? null });
    } catch {
      toast.error('Failed to fetch document file for re-extraction');
    }
  };

  if (!document) return null;

  const overallConf = document.ocr_confidence;
  const mime = document.mime_type ?? '';
  const fileName = document.file_name ?? '';
  const isImage = mime.startsWith('image/') || /\.(png|jpe?g|webp|tiff?)$/i.test(fileName);
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(fileName);
  const previewHeight = 'h-[min(70vh,600px)]';

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="OCR Review"
      widthClass="max-w-6xl"
      actions={
        <>
          <div className="mr-auto flex items-center gap-2">
            <select
              value={reextractType}
              onChange={(e) => setReextractType(e.target.value as PromptType)}
              className="h-8 px-2 border border-slate-300 rounded-md text-xs bg-[#0c0c0c] cursor-pointer"
              aria-label="Re-extract document type"
            >
              {REEXTRACT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <Button size="sm" variant="secondary" onClick={handleReextract} loading={extract.isPending} leftIcon={<RefreshCw size={14} />}>
              Re-extract
            </Button>
          </div>
          <Button size="sm" variant="danger" onClick={() => setStatus('flagged')} loading={update.isPending} leftIcon={<ThumbsDown size={14} />}>
            Reject
          </Button>
          <Button size="sm" onClick={() => setStatus('verified')} loading={update.isPending} leftIcon={<ThumbsUp size={14} />}>
            Verify
          </Button>
          <Button size="sm" variant="secondary" onClick={handleDownload} loading={loading} leftIcon={<Download size={14} />}>
            Download
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={saveEdits}
            loading={update.isPending}
            disabled={!isDirty}
            leftIcon={<Save size={14} />}
            title={isDirty ? `Save ${editedKeys.size} edited field(s)` : 'No unsaved field changes'}
          >
            {isDirty ? `Save ${editedKeys.size} Edit${editedKeys.size === 1 ? '' : 's'}` : 'No changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Header: identity + metadata grid (the raw UUID was the old headline) */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm text-slate-800 font-medium">
              <FileText size={15} className="shrink-0" />
              <span className="truncate">{document.file_name ?? document.doc_type}</span>
              <Badge variant="neutral">{document.doc_type}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              <MetaItem label="Parcel" title={document.parcel_id}>
                {parcel ? `${parcel.parcel_number} — ${parcel.owner_name}` : `${document.parcel_id.slice(0, 8)}…`}
              </MetaItem>
              <MetaItem label="Village / district">
                {parcel ? `${parcel.village ?? '-'} / ${parcel.district ?? '-'}` : '-'}
              </MetaItem>
              <MetaItem label="Language">{document.language ?? '-'}</MetaItem>
              <MetaItem label="File size">{formatSize(document.file_size)}</MetaItem>
              <MetaItem label="Uploaded">{formatWhen(document.created_at)}</MetaItem>
              <MetaItem label="Last updated">{formatWhen(document.updated_at)}</MetaItem>
            </div>
            {/* Which engine produced this text. Without it, a Gemini-only PDF
                result is indistinguishable from a real hybrid OCR run. */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              {pipelineText ? (
                <>
                  <span>OCR: <span className="text-slate-700">{pipelineText.ocr}</span></span>
                  <span>Translation: <span className="text-slate-700">{pipelineText.translation}</span></span>
                  <span>Extraction: <span className="text-slate-700">{pipelineText.extraction}</span></span>
                </>
              ) : (
                <span>Pipeline: not recorded (extracted before provenance tracking — re-extract to record it)</span>
              )}
            </div>
            {pipeline && (pipeline.tesseract === 'failed' || (pipeline.tesseract === 'skipped' && pipeline.indicTrans !== 'ran')) && (
              <p className="mt-2 text-[11px] text-amber-600">
                Local OCR did not run ({pipeline.tesseractDetail || pipeline.tesseract}) — values come from Gemini vision alone.
              </p>
            )}
          </div>
          <Badge variant={statusToBadgeVariant(document.status)} className="text-sm shrink-0">
            {document.status}
          </Badge>
        </div>

        {/* Split view: preview left, extracted editor right.
            `xl:` (not `lg:`) so two columns only appear when the viewport can
            actually afford them — `lg:` is viewport-based and used to force two
            ~220px columns inside a 512px modal, which truncated every field
            value to three characters. */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Left: file preview */}
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="font-medium text-slate-800 text-sm">Preview</h4>
              {signedUrl && (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#38bdf8] hover:underline"
                >
                  Open in new tab <ExternalLink size={12} />
                </a>
              )}
            </div>
            <div className={`${previewHeight} rounded-lg border border-slate-200 bg-[#0c0c0c] overflow-hidden`}>
              {!document.file_url ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-slate-400">
                  <FileWarning size={28} />
                  No file attached
                </div>
              ) : previewState === 'loading' ? (
                <div className="h-full flex items-center justify-center gap-2 text-sm text-slate-400">
                  <RefreshCw size={14} className="animate-spin" />
                  Loading preview…
                </div>
              ) : previewState === 'error' || !signedUrl ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-slate-400">
                  <FileWarning size={28} className="text-red-600" />
                  <p>
                    Preview unavailable — the signed URL could not be created
                    (storage RLS, or the object is missing from the bucket).
                  </p>
                  <Button size="sm" variant="secondary" onClick={handleDownload} leftIcon={<Download size={14} />}>
                    Download instead
                  </Button>
                </div>
              ) : isImage ? (
                <img src={signedUrl} alt={fileName || 'Document preview'} className="w-full h-full object-contain" />
              ) : isPdf ? (
                <object data={signedUrl} type="application/pdf" className="w-full h-full">
                  <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-400">
                    <FileWarning size={28} />
                    <p>This browser can&apos;t display PDFs inline.</p>
                    <a href={signedUrl} target="_blank" rel="noreferrer" className="text-[#38bdf8] hover:underline">
                      Open in a new tab
                    </a>
                  </div>
                </object>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-slate-400">
                  <FileWarning size={28} />
                  <p>Inline preview not supported for {mime || 'this file type'}.</p>
                  <Button size="sm" variant="secondary" onClick={handleDownload} leftIcon={<Download size={14} />}>
                    Download
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right: extracted fields editor with per-field confidence */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h4 className="font-medium text-slate-800 text-sm flex items-center gap-1.5">
                <CheckCircle size={14} className="text-green-600" /> Extracted Fields
                <span className="text-[11px] font-normal text-slate-500">({Object.keys(fields).length})</span>
              </h4>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 border border-amber-200 bg-amber-50 rounded px-1.5 py-0.5">
                    <PencilLine size={11} /> {editedKeys.size} unsaved
                  </span>
                )}
                {confidenceBadge(overallConf ?? null)}
              </div>
            </div>
            <div className="mb-3">
              <ConfidenceLegend />
            </div>
            {extracted?.extracted_fields && Object.keys(fields).length > 0 ? (
              <div className="space-y-3 max-h-[min(60vh,540px)] overflow-auto pr-1">
                {Object.entries(fields).map(([key, value]) => {
                  const conf = confByKey[normKey(key)];
                  const edited = editedKeys.has(key);
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={fieldId(key)}
                          className="text-[11px] uppercase tracking-wide text-slate-500 truncate"
                          title={key}
                        >
                          {prettyKey(key)}
                        </label>
                        <span className="flex items-center gap-1.5 shrink-0">
                          {edited && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600" title="You changed this value">
                              <PencilLine size={11} /> edited
                            </span>
                          )}
                          {confidenceBadge(conf ?? null, edited)}
                        </span>
                      </div>
                      <input
                        id={fieldId(key)}
                        value={value}
                        onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
                        className={`w-full h-10 px-3 border rounded-md text-sm bg-[#0c0c0c] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#38bdf8] ${
                          edited ? 'border-amber-400' : 'border-slate-300'
                        } ${NUMERIC_FIELD.test(key) ? 'font-mono' : ''}`}
                      />
                    </div>
                  );
                })}
                <p className="text-[11px] text-slate-500 pt-1">
                  Field edits are saved with the button at the bottom right and never change the verification status.
                </p>
              </div>
            ) : (
              <div className={`${previewHeight} flex flex-col items-center justify-center text-center text-sm text-slate-400 border border-slate-200 rounded-lg px-4`}>
                <Clock size={28} className="mb-2 text-slate-400" />
                <p>No extracted data yet. Use Re-extract below to run OCR → translation → Gemini on this file.</p>
              </div>
            )}
          </div>
        </div>

        {/* Original vs translated side by side — previously two stacked blocks
            that pushed everything below the fold. */}
        {(document.translated_text || document.ocr_raw_text) && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {document.translated_text && (
              <section className="min-w-0 border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="font-medium text-slate-800 flex items-center gap-2 text-sm">
                    <Globe size={15} className="text-blue-600" /> Translated Text
                  </h4>
                  <button
                    type="button"
                    onClick={() => copyText(document.translated_text as string, 'translated')}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {copied === 'translated' ? <CheckCircle size={12} /> : <Copy size={12} />}
                    {copied === 'translated' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap max-h-[45vh] overflow-auto">
                  {document.translated_text}
                </p>
              </section>
            )}

            {document.ocr_raw_text && (
              <section className="min-w-0 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="font-medium text-slate-800 flex items-center gap-2 text-sm">
                    <FileText size={15} className="text-slate-600" /> Raw OCR Text
                  </h4>
                  <button
                    type="button"
                    onClick={() => copyText(document.ocr_raw_text as string, 'raw')}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {copied === 'raw' ? <CheckCircle size={12} /> : <Copy size={12} />}
                    {copied === 'raw' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap max-h-[45vh] overflow-auto">
                  {document.ocr_raw_text}
                </p>
              </section>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
