import { describe, it, expect } from 'vitest';
import { OCR_LANG_MAP, OCR_DEFAULT_LANGS, tesseractLangsFor } from './ocr-langs';

// Codes offered by the DocumentUpload dropdown — must all be OCR-selectable.
const APP_LANGS = ['en', 'hi', 'ur', 'pa', 'ta', 'bn', 'te', 'mr', 'gu', 'kn', 'ml', 'or', 'as', 'sa'];

describe('ocr-langs', () => {
  it('covers every language offered by the upload dropdown', () => {
    for (const code of APP_LANGS) {
      expect(OCR_LANG_MAP[code], `missing traineddata code for "${code}"`).toBeTruthy();
    }
  });

  it('maps app codes to official tesseract traineddata codes', () => {
    expect(OCR_LANG_MAP.en).toBe('eng');
    expect(OCR_LANG_MAP.hi).toBe('hin');
    expect(OCR_LANG_MAP.ur).toBe('urd');
    expect(OCR_LANG_MAP.bn).toBe('ben');
    expect(OCR_LANG_MAP.pa).toBe('pan'); // not 'pun'
    expect(OCR_LANG_MAP.or).toBe('ori'); // not 'ory' (that one is the IndicTrans code)
    expect(OCR_LANG_MAP.as).toBe('asm');
    expect(OCR_LANG_MAP.sa).toBe('san');
  });

  it('pairs the regional script with eng, eng first', () => {
    expect(tesseractLangsFor('ta')).toEqual(['eng', 'tam']);
    expect(tesseractLangsFor('hi')).toEqual(['eng', 'hin']);
    expect(tesseractLangsFor('ur')).toEqual(['eng', 'urd']);
    expect(tesseractLangsFor('ml')).toEqual(['eng', 'mal']);
  });

  it('never loads a second model for English', () => {
    expect(tesseractLangsFor('en')).toEqual(['eng']);
  });

  it('falls back to the mixed-script default set', () => {
    expect(tesseractLangsFor()).toEqual([...OCR_DEFAULT_LANGS]);
    expect(tesseractLangsFor(null)).toEqual([...OCR_DEFAULT_LANGS]);
    expect(tesseractLangsFor('')).toEqual([...OCR_DEFAULT_LANGS]);
    expect(tesseractLangsFor('klingon')).toEqual([...OCR_DEFAULT_LANGS]);
  });

  it('tolerates case, whitespace and region suffixes', () => {
    expect(tesseractLangsFor(' TA ')).toEqual(['eng', 'tam']);
    expect(tesseractLangsFor('hi-IN')).toEqual(['eng', 'hin']);
    expect(tesseractLangsFor('EN-IN')).toEqual(['eng']);
  });

  it('returns a fresh array so callers cannot mutate the default set', () => {
    const a = tesseractLangsFor();
    a.push('corrupted');
    expect(tesseractLangsFor()).toEqual([...OCR_DEFAULT_LANGS]);
  });
});
