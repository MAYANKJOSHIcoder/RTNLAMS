import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callGemini, extractFromFile, consumePipelineWarnings, consumePipelineReport } from '../lib/gemini/client';
import { PROMPT_MAP, type PromptType } from '../lib/gemini/prompts';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import type { GeminiExtractionResponse } from '../lib/types';
import toast from 'react-hot-toast';

export function useGeminiExtraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      imageBase64,
      promptType = 'deed',
      documentId,
      language,
    }: {
      file?: File;
      imageBase64?: string;
      promptType?: PromptType;
      documentId?: string;
      /** App language code (en/hi/ur/tam/…) — selects the Tesseract traineddata set. */
      language?: string | null;
    }): Promise<GeminiExtractionResponse> => {
      const prompt = PROMPT_MAP[promptType] ?? PROMPT_MAP.deed;
      let raw: string;
      if (file) raw = await extractFromFile(file, prompt, language);
      else if (imageBase64) raw = await callGemini({ prompt, imageBase64, language });
      else {
        // Direct text prompt (no image) — skips Tesseract/IndicTrans preprocessing
        raw = await callGemini({ prompt });
      }

      let parsed: GeminiExtractionResponse;
      try {
        const cleaned = raw
          .trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '');
        parsed = JSON.parse(cleaned) as GeminiExtractionResponse;
      } catch (e) {
        throw new Error(`Failed to parse Gemini JSON: ${(e as Error).message} — raw: ${raw.slice(0, 400)}`);
      }

      // Persist to documents table if documentId given and Supabase configured
      if (documentId && isSupabaseConfigured()) {
        // Which engine actually produced this text (Tesseract/IndicTrans/Gemini)
        // is stored alongside the fields so the review modal can be honest about
        // e.g. a PDF that never had a local OCR pass.
        const pipeline = consumePipelineReport();
        const { data: updated, error } = await supabase
          .from('documents')
          .update({
            ocr_extracted_data: { ...(parsed as unknown as Record<string, unknown>), pipeline } as unknown as Record<string, unknown>,
            ocr_raw_text: parsed.original_text ?? raw,
            translated_text: parsed.translated_text,
            ocr_confidence: parsed.confidence,
            language: parsed.document_language,
            status: 'extracted',
          })
          .eq('id', documentId)
          .select('id');
        if (error) throw new Error(error.message);
        if (!updated || updated.length === 0) throw new Error('Extraction not saved — RLS blocked the write (need admin/field_officer role)');
      }

      return parsed;
    },
    onSuccess: (_data, vars) => {
      if (vars.documentId) qc.invalidateQueries({ queryKey: ['documents'] });
      consumePipelineWarnings().forEach((w) => toast(w, { icon: '⚠️' }));
      toast.success('Extraction completed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Alias per PROMPTS naming
export const useGemini = useGeminiExtraction;
export default useGeminiExtraction;
