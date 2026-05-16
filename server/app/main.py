from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.routes import media, upload, folders

app = FastAPI(title="PocketVault")

app.include_router(media.router)
app.include_router(upload.router)
app.include_router(folders.router)

# Serve web UI — must be last so API routes take priority
app.mount("/", StaticFiles(directory="static", html=True), name="static")
