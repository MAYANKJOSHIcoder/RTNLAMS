import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callGemini, extractFromFile, consumePipelineWarnings } from '../lib/gemini/client';
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
    }: {
      file?: File;
      imageBase64?: string;
      promptType?: PromptType;
      documentId?: string;
    }): Promise<GeminiExtractionResponse> => {
      const prompt = PROMPT_MAP[promptType] ?? PROMPT_MAP.deed;
      let raw: string;
      if (file) raw = await extractFromFile(file, prompt);
      else if (imageBase64) raw = await callGemini({ prompt, imageBase64 });
      else {
        // Direct text prompt (no image) — still exercises hybrid context with mock Tesseract
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
        const { error } = await supabase
          .from('documents')
          .update({
            ocr_extracted_data: parsed as unknown as Record<string, unknown>,
            ocr_raw_text: parsed.original_text ?? raw,
            translated_text: parsed.translated_text,
            ocr_confidence: parsed.confidence,
            language: parsed.document_language,
            status: 'extracted',
          })
          .eq('id', documentId);
        if (error) throw new Error(error.message);
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
