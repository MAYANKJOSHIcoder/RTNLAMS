#!/usr/bin/env python3
"""
Pre-download IndicTrans2 model weights from HuggingFace.
Run this once before starting the server to avoid first-run delays.
"""
import os
from huggingface_hub import snapshot_download

# Model variants — uncomment the ones you need
MODELS = [
    "ai4bharat/indictrans2-en-indic-dist-200M",      # En → Indic (distilled, 950 MB VRAM)
    "ai4bharat/indictrans2-indic-en-dist-200M",      # Indic → En (distilled, 950 MB VRAM)
    # "ai4bharat/indictrans2-indic-indic-dist-320M", # Indic → Indic (distilled, 950 MB VRAM)
    # "ai4bharat/indictrans2-en-indic-1B",           # En → Indic (base, 4.5 GB VRAM)
    # "ai4bharat/indictrans2-indic-en-1B",           # Indic → En (base, 4.5 GB VRAM)
    # "ai4bharat/indictrans2-indic-indic-1B",        # Indic → Indic (base, 4.5 GB VRAM)
]

def main():
    print("Downloading IndicTrans2 models from HuggingFace...")
    print("Note: You must accept the model license on the HF model page first.")
    print("See: https://huggingface.co/ai4bharat/indictrans2-en-indic-dist-200M")
    print()

    for model_id in MODELS:
        print(f"→ {model_id}")
        try:
            path = snapshot_download(repo_id=model_id, local_files_only=False)
            print(f"  ✓ Saved to {path}")
        except Exception as e:
            print(f"  ✗ Failed: {e}")
            print(f"  Make sure you've accepted the license at https://huggingface.co/{model_id}")
        print()

    print("Done. Models cached in ~/.cache/huggingface/hub/")

if __name__ == "__main__":
    main()