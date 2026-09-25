import { useState, useRef } from 'react';
import { Upload, FileText, X, Globe } from 'lucide-react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { useUploadDocument } from '../../hooks/useDocuments';
import { useRecalcRiskForParcel } from '../../hooks/useRisk';
import { useGeminiExtraction } from '../../hooks/useGemini';
import type { PromptType } from '../../lib/gemini/prompts';
import { compressImage } from '../../lib/utils/image';

// App language codes — kept in sync with OCR_LANG_MAP (src/lib/gemini/ocr-langs.ts)
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ur', label: 'Urdu' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'bn', label: 'Bengali' },
  { value: 'te', label: 'Telugu' },
  { value: 'mr', label: 'Marathi' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'or', label: 'Odia' },
  { value: 'as', label: 'Assamese' },
  { value: 'sa', label: 'Sanskrit' },
];

interface DocumentUploadProps {
  parcelId: string;
  onUploaded?: () => void;
}

export default function DocumentUpload({ parcelId, onUploaded }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('en');
  const [docType, setDocType] = useState('deed');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument();
  const extract = useGeminiExtraction();
  const recalcRisk = useRecalcRiskForParcel();

  const handleFile = async (f: File | null) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      alert('File exceeds 10MB limit');
      return;
    }
    setFile(await compressImage(f));
  };

  const handleUpload = async () => {
    if (!file) return;
    // deed/survey_map/handwritten_deed map 1:1; title/other use the generic deed prompt
    const promptType: PromptType = docType === 'survey_map' || docType === 'handwritten_deed' ? docType : 'deed';
    try {
      const doc = await upload.mutateAsync({ file, parcelId, docType, language });
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded?.();
      // Auto-run OCR pipeline (Tesseract → IndicTrans → Gemini) right after upload.
      // `language` picks the Tesseract traineddata set (eng + the selected Indic script).
      await extract.mutateAsync({ file, documentId: doc.id, promptType, language });
      recalcRisk.mutate(parcelId);
    } catch {
      /* toasts already shown by the mutations */
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-[#38bdf8] bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-[#0c0c0c]'
        }`}
        role="button"
        aria-label="Upload document"
        tabIndex={0}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
            <Upload size={18} className="text-slate-500" />
          </div>
          <p className="text-sm font-medium text-slate-700">Drag & drop or click to upload</p>
          <p className="text-xs text-slate-500">PDF, JPG, PNG, TIFF — max 10MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {file && (
        <div className="bg-[#0c0c0c] border border-slate-200 rounded-lg p-3 flex items-center gap-3">
          <FileText size={18} className="text-slate-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">{file.name}</div>
            <div className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFile(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="p-1 hover:bg-slate-100 rounded cursor-pointer"
            aria-label="Remove file"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="docType" className="block text-sm font-medium text-slate-700 mb-1">
            Document type
          </label>
          <select
            id="docType"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full h-9 px-3 border border-slate-300 rounded-md text-sm bg-[#0c0c0c] focus:outline-none focus:ring-2 focus:ring-[#38bdf8] cursor-pointer"
          >
            <option value="deed">Deed</option>
            <option value="survey_map">Survey Map</option>
            <option value="handwritten_deed">Handwritten Deed</option>
            <option value="title">Title Document</option>
            <option value="other">Other</option>
          </select>
        </div>
        <Select
          label="Language"
          options={LANGUAGES}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          placeholder="Select language"
        />
      </div>

      {upload.isPending && (
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <Spinner size="sm" /> Uploading {file?.name}…
        </p>
      )}

      {upload.isSuccess && extract.isPending && (
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <Spinner size="sm" /> Extracting text (OCR → translate → Gemini)…
        </p>
      )}

      <Button
        onClick={handleUpload}
        disabled={!file || upload.isPending || extract.isPending}
        loading={upload.isPending || extract.isPending}
        leftIcon={<Globe size={16} />}
        className="w-full"
      >
        {upload.isPending ? 'Uploading…' : extract.isPending ? 'Extracting…' : 'Upload Document'}
      </Button>

      {upload.isError && <p className="text-xs text-red-600">{(upload.error as Error).message}</p>}
    </div>
  );
}
