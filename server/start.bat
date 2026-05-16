@echo off
cd /d "%~dp0"
echo Installing dependencies...
pip install -r requirements.txt
echo.
echo Starting PocketVault server...
echo Open http://localhost:8000 in your browser
echo.
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
