#!/bin/bash
# IndicTrans2 Server Start Script
# Run from indictrans-server directory: ./start.sh

set -e

echo "Starting IndicTrans2 FastAPI server on http://localhost:8080"
echo "Model: ${INDIC_MODEL:-ai4bharat/indictrans2-en-indic-dist-200M}"
echo "Device: $(python3 -c "import torch; print('cuda' if torch.cuda.is_available() else 'cpu')")"
echo

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
else
    source .venv/bin/activate
fi

# Run server
exec uvicorn server:app --host 0.0.0.0 --port 8080 --reload