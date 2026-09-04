"""
IndicTrans2 FastAPI Server — wraps AI4Bharat IndicTrans2 for HTTP translation.
Run: uvicorn server:app --host 0.0.0.0 --port 8080 --reload
Model: ai4bharat/indictrans2-en-indic-dist-200M (950 MB VRAM, GPU recommended)
"""

import os
import torch
from fastapi import FastAPI, HTTPException
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


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", model=MODEL_NAME, device=DEVICE)


@app.post("/translate", response_model=TranslateResponse)
def translate(req: TranslateRequest) -> TranslateResponse:
    if not req.sentences:
        raise HTTPException(status_code=400, detail="sentences list cannot be empty")

    src = map_lang(req.src_lang)
    tgt = map_lang(req.tgt_lang)

    # Preprocess (mandatory: normalizes unicode, adds language tags)
    batch = ip.preprocess_batch(req.sentences, src_lang=src, tgt_lang=tgt)

    # Tokenize
    inputs = tokenizer(batch, truncation=True, padding="longest", return_tensors="pt").to(DEVICE)

    # Generate
    with torch.no_grad():
        generated = model.generate(**inputs, max_length=MAX_LENGTH, num_beams=NUM_BEAMS)

    # Decode + postprocess
    with tokenizer.as_target_tokenizer():
        decoded = tokenizer.batch_decode(generated, skip_special_tokens=True)

    translations = ip.postprocess_batch(decoded, lang=tgt)

    return TranslateResponse(translations=translations, src_lang=src, tgt_lang=tgt)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)