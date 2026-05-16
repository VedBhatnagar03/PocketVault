import mimetypes
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.core.auth import require_auth
from app.core.config import MEDIA_DIR
from app.core.utils import get_media_type, safe_resolve

router = APIRouter(prefix="/api/media", tags=["media"])


@router.get("")
def list_media(folder: str = "", _: str = Depends(require_auth)):
    target = MEDIA_DIR / folder if folder else MEDIA_DIR
    if not target.exists() or not target.is_dir():
        raise HTTPException(status_code=404, detail="Folder not found")

    items = []
    for entry in sorted(target.iterdir(), key=lambda e: e.stat().st_mtime, reverse=True):
        media_type = get_media_type(entry) if entry.is_file() else "folder"
        if media_type == "other" and entry.is_file():
            continue
        rel = entry.relative_to(MEDIA_DIR)
        stat = entry.stat()
        items.append({
            "name": entry.name,
            "path": str(rel).replace("\\", "/"),
            "type": media_type,
            "size": stat.st_size if entry.is_file() else None,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })

    return {"items": items, "folder": folder}


@router.get("/file/{path:path}")
def serve_file(path: str, _: str = Depends(require_auth)):
    file_path = safe_resolve(path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    mime, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(str(file_path), media_type=mime or "application/octet-stream")


@router.delete("/file/{path:path}")
def delete_file(path: str, _: str = Depends(require_auth)):
    file_path = safe_resolve(path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    file_path.unlink()
    return {"deleted": path}
