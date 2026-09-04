@echo off
REM IndicTrans2 Server Start Script (Windows)
REM Run from indictrans-server directory: start.bat

echo Starting IndicTrans2 FastAPI server on http://localhost:8080
echo Model: %INDIC_MODEL%
if "%INDIC_MODEL%"=="" set INDIC_MODEL=ai4bharat/indictrans2-en-indic-dist-200M
echo Model: %INDIC_MODEL%

REM Check if virtual environment exists
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate.bat
)

REM Run server
uvicorn server:app --host 0.0.0.0 --port 8080 --reload