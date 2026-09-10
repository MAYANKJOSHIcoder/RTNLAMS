"""
IndicTrans2 FastAPI Server — wraps AI4Bharat IndicTrans2 for HTTP translation.
Run: uvicorn server:app --host 0.0.0.0 --port 8080 --reload
Model: ai4bharat/indictrans2-en-indic-dist-200M (950 MB VRAM, GPU recommended)
"""

import os
import re
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from IndicTransToolkit import IndicProcessor

# ──────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────
MODEL_NAME = os.getenv("INDIC_MODEL", "ai4bharat/indictrans2-en-indic-dist-200M")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MAX_LENGTH = 256
NUM_BEAMS = 5

# Language code mapping: frontend simple codes → IndicTrans2 codes
LANG_MAP = {
    "en": "eng_Latn",
    "hi": "hin_Deva",
    "ur": "urd_Arab",
    "ta": "tam_Taml",
    "bn": "ben_Beng",
    "te": "tel_Telu",
    "mr": "mar_Deva",
    "gu": "guj_Gujr",
    "kn": "kan_Knda",
    "ml": "mal_Mlym",
    "pa": "pan_Guru",
    "or": "ory_Orya",
    "as": "asm_Beng",
}

# ──────────────────────────────────────────────────
# Load model at startup
# ──────────────────────────────────────────────────
print(f"[IndicTrans2] Loading {MODEL_NAME} on {DEVICE}...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
model = AutoModelForSeq2SeqLM.from_pretrained(
    MODEL_NAME, trust_remote_code=True, torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32
).to(DEVICE)
ip = IndicProcessor(inference=True)
print("[IndicTrans2] Model loaded successfully")

# ──────────────────────────────────────────────────
# FastAPI app
# ──────────────────────────────────────────────────
app = FastAPI(title="IndicTrans2 Translation API", version="1.0.0")

# Local-only dev server (keyless) — allow the Vite frontend's CORS preflight
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class TranslateRequest(BaseModel):
    sentences: list[str]
    src_lang: str  # e.g., "en", "hi"
    tgt_lang: str  # e.g., "hi", "en"


class TranslateResponse(BaseModel):
    translations: list[str]
    src_lang: str
    tgt_lang: str


class HealthResponse(BaseModel):
    status: str
    model: str
    device: str


def map_lang(code: str) -> str:
    """Map simple language code to IndicTrans2 format."""
    return LANG_MAP.get(code.lower(), code)


# Unicode script ranges for auto-detection (src_lang="auto" from the frontend)
SCRIPT_RANGES: list[tuple[str, str]] = [
    ("urd", r"[\u0600-\u06FF]"),   # Arabic script → Urdu
    ("dev", r"[\u0900-\u097F]"),   # Devanagari → Hindi
    ("ben", r"[\u0980-\u09FF]"),   # Bengali
    ("pan", r"[\u0A00-\u0A7F]"),   # Gurmukhi → Punjabi
    ("guj", r"[\u0A80-\u0AFF]"),   # Gujarati
    ("ory", r"[\u0B00-\u0B7F]"),   # Odia
    ("tam", r"[\u0B80-\u0BFF]"),   # Tamil
    ("tel", r"[\u0C00-\u0C7F]"),   # Telugu
    ("kan", r"[\u0C80-\u0CFF]"),   # Kannada
    ("mal", r"[\u0D00-\u0D7F]"),   # Malayalam
]


def detect_lang(text: str) -> str:
    """Return simple lang code for the dominant Indic script in text, else 'en'."""
    for _prefix, pattern in SCRIPT_RANGES:
        if re.search(pattern, text):
            # map back through LANG_MAP: find the simple code whose IndicTrans2 code starts with prefix
            for simple, full in LANG_MAP.items():
                if full.startswith(_prefix):
                    return simple
    return "en"


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", model=MODEL_NAME, device=DEVICE)


@app.post("/translate", response_model=TranslateResponse)
def translate(req: TranslateRequest) -> TranslateResponse:
    if not req.sentences:
        raise HTTPException(status_code=400, detail="sentences list cannot be empty")

    src_requested = req.src_lang.lower()
    src_code = detect_lang(" ".join(req.sentences)) if src_requested == "auto" else req.src_lang
    src = map_lang(src_code)
    tgt = map_lang(req.tgt_lang)

    # Preprocess (mandatory: normalizes unicode, adds language tags)
    batch = ip.preprocess_batch(req.sentences, src_lang=src, tgt_lang=tgt)

    # Tokenize
    inputs = tokenizer(batch, truncation=True, padding="longest", return_tensors="pt").to(DEVICE)

    # Generate
    with torch.no_grad():
        # use_cache=False: transformers 4.5x passes Cache objects the bundled IndicTrans2 code can't read
        generated = model.generate(**inputs, max_length=MAX_LENGTH, num_beams=NUM_BEAMS, use_cache=False)

    # Decode + postprocess
    with tokenizer.as_target_tokenizer():
        decoded = tokenizer.batch_decode(generated, skip_special_tokens=True)

    translations = ip.postprocess_batch(decoded, lang=tgt)

    return TranslateResponse(translations=translations, src_lang=src, tgt_lang=tgt)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)