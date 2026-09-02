/**
 * PROMPT 13 — Gemini Prompts (IndicTrans + Tesseract hybrid per PROMPTS_indictrans.md:326)
 */

export const DEED_EXTRACTION_PROMPT = `
You are an Indic deed extraction engine. Use IndicTrans to identify/normalize the document language and translate to English when needed, while preserving the original text. Use Tesseract OCR to extract raw text. Reconcile both outputs and extract: owner_name, father_name, survey_number, plot_dimensions, land_area, property_boundaries, registration_date, stamp_duty_amount, witness_names, document_language, translated_text.
Return structured JSON with: original_text, translated_text, extracted_fields {owner_name, father_name, survey_number, plot_dimensions, land_area, property_boundaries, registration_date, stamp_duty_amount, witness_names}, document_language, confidence (0-1), confidence_per_field (object).
Preserve original script, flag uncertain readings (<0.5) with note. Return ONLY JSON.
`.trim();

export const SURVEY_MAP_PROMPT = `
Use Tesseract to OCR all visible labels. Use IndicTrans for language detection/translation of non-English labels. Extract plot_boundaries, area_measurements, neighboring_plots, surveyor_name, survey_date, translated_annotations.
Return structured JSON: { original_text, translated_text, document_language, extracted_fields: { plot_boundaries, area_measurements, neighboring_plots, surveyor_name, survey_date, translated_annotations }, confidence, confidence_per_field }.
Return ONLY JSON.
`.trim();

export const HANDWRITTEN_DEED_PROMPT = `
Run Tesseract OCR on the handwritten deed, then use IndicTrans to detect and translate the language where applicable. Preserve original text, flag uncertain readings, and return JSON with original_text, translated_text, extracted_fields, confidence per field, and document_language.
If handwriting is illegible, set confidence <0.4 and add warning in warnings[].
Schema: { original_text, translated_text, document_language, extracted_fields, confidence, confidence_per_field, warnings }
Return ONLY JSON.
`.trim();

export const PROMPT_MAP = {
  deed: DEED_EXTRACTION_PROMPT,
  survey_map: SURVEY_MAP_PROMPT,
  handwritten_deed: HANDWRITTEN_DEED_PROMPT,
} as const;

export type PromptType = keyof typeof PROMPT_MAP;
