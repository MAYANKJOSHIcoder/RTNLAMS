import { useEffect, useState } from 'react';
import { FileText, Globe, CheckCircle, Clock, Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge, statusToBadgeVariant } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import type { Document as DocType } from '../../lib/types';

interface DocumentDetailProps {
  document: DocType | null;
  onClose: () => void;
}

export default function DocumentDetail({ document, onClose }: DocumentDetailProps) {
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!document?.ocr_extracted_data) {
      setExtracted(null);
      return;
    }
    setExtracted(document.ocr_extracted_data as Record<string, unknown>);
  }, [document]);

  const handleDownload = async () => {
    if (!document?.file_url) return;
    setLoading(true);
    try {
      const res = await fetch(document.file_url);
      const blob = await res.blob();
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

  if (!document) return null;

  return (
    <Modal open={true} onClose={onClose} title="Document Details">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <FileText size={14} />
              <span>{document.file_name ?? document.doc_type}</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{document.doc_type.replace('_', ' ')}</h3>
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

        {/* OCR Extracted Data */}
        {extracted && (
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-green-600" /> Extracted Fields
            </h4>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {Object.entries(extracted).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-slate-500">{key.replace(/_/g, ' ')}</dt>
                  <dd className="font-mono text-slate-900 break-all">{String(value)}</dd>
                </div>
              ))}
            </dl>
            {document.ocr_confidence && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>OCR Confidence:</span>
                  <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600"
                      style={{ width: `${Math.round((document.ocr_confidence ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span>{Math.round((document.ocr_confidence ?? 0) * 100)}%</span>
                </div>
              </div>
            )}
          </div>
        )}

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

        {!extracted && !document.translated_text && !document.ocr_raw_text && (
          <div className="text-center py-8 text-slate-500">
            <Clock size={32} className="mx-auto mb-2 text-slate-300" />
            <p>No extracted data available. Document may still be processing.</p>
            {document.status === 'uploaded' && (
              <p className="text-xs mt-1">Status: {document.status} — extraction runs async via Gemini.</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <Button variant="secondary" onClick={handleDownload} loading={loading} leftIcon={<Download size={16} />}>
            Download
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}