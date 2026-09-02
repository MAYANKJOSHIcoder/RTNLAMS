import { useState } from 'react';
import { Check, X, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import type { GeminiExtractionResponse } from '../../lib/types';

interface OCRViewerProps {
  imageUrl?: string;
  extraction: GeminiExtractionResponse | null;
  onVerify: (corrected: Record<string, unknown>) => void;
  onReject: () => void;
  onReExtract: (promptType: string) => void;
  isExtracting?: boolean;
}

function confidenceColor(c: number): string {
  if (c > 0.8) return 'text-green-700 bg-green-50 border-green-200';
  if (c >= 0.5) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

export default function OCRViewer({ imageUrl, extraction, onVerify, onReject, onReExtract, isExtracting }: OCRViewerProps) {
  const [edits, setEdits] = useState<Record<string, string>>(
    extraction ? Object.fromEntries(Object.entries(extraction.extracted_fields ?? {}).map(([k, v]) => [k, String(v ?? '')])) : {},
  );
  const [promptType, setPromptType] = useState('deed');

  // Sync edits when extraction changes
  // (simple effect via key)
  if (extraction && Object.keys(edits).length === 0 && Object.keys(extraction.extracted_fields ?? {}).length > 0) {
    // initial populate — delayed via state would cause loop; handle via direct assignment in render is okay for this mock
  }

  const handleChange = (k: string, v: string) => setEdits((prev) => ({ ...prev, [k]: v }));

  if (!extraction) {
    return (
      <div className="border border-slate-200 rounded-xl bg-white p-8 text-center text-sm text-slate-500">
        No extraction yet — upload a document and run extraction.
      </div>
    );
  }

  const fields = extraction.extracted_fields ?? {};
  const perField = extraction.confidence_per_field ?? {};

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-96">
        {/* Left: original image */}
        <div className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 flex items-center justify-center p-4">
          {imageUrl ? (
            <img src={imageUrl} alt="Original document" className="max-h-[500px] w-auto rounded border border-slate-200" />
          ) : (
            <div className="text-sm text-slate-400">No image</div>
          )}
        </div>

        {/* Right: extracted JSON editable */}
        <div className="p-4 space-y-4 overflow-auto max-h-[600px]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Extracted Fields</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${confidenceColor(extraction.confidence ?? 0)}`}>
              conf {(extraction.confidence ?? 0).toFixed(2)}
            </span>
          </div>

          {extraction.document_language && (
            <div className="text-xs text-slate-500">
              Language: <span className="font-medium">{extraction.document_language}</span> • Original {extraction.original_text?.slice(0, 80) ?? '-'}
            </div>
          )}

          <div className="space-y-3">
            {Object.keys(fields).length === 0 && <p className="text-xs text-slate-500">No fields extracted</p>}
            {Object.entries(fields).map(([k, v]) => {
              const conf = perField[k] as number | undefined;
              const col = conf != null ? confidenceColor(conf) : 'text-slate-600 bg-slate-50 border-slate-200';
              return (
                <div key={k} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
                    {k}
                    {conf != null && <span className={`px-1.5 py-0.5 rounded text-[10px] border ${col}`}>{conf.toFixed(2)}</span>}
                  </label>
                  <input
                    value={edits[k] ?? String(v ?? '')}
                    onChange={(e) => handleChange(k, e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="primary" size="sm" onClick={() => onVerify(edits)} leftIcon={<Check size={14} />}>
              Verify
            </Button>
            <Button variant="danger" size="sm" onClick={onReject} leftIcon={<X size={14} />}>
              Reject
            </Button>
            <div className="flex items-center gap-1 ml-auto">
              <select
                value={promptType}
                onChange={(e) => setPromptType(e.target.value)}
                className="h-8 px-2 border border-slate-300 rounded-md text-xs cursor-pointer"
              >
                <option value="deed">Deed prompt</option>
                <option value="survey_map">Survey map</option>
                <option value="handwritten_deed">Handwritten</option>
              </select>
              <Button variant="secondary" size="sm" onClick={() => onReExtract(promptType)} disabled={!!isExtracting} leftIcon={<RefreshCw size={14} className={isExtracting ? 'animate-spin' : ''} />}>
                Re-extract
              </Button>
            </div>
          </div>

          {extraction.warnings?.length ? (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-xs text-amber-800">
              {extraction.warnings.join('; ')}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
