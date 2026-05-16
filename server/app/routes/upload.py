import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile

from app.core.auth import require_auth
from app.core.config import MEDIA_DIR, SUPPORTED_EXTENSIONS

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("")
async def upload(
    files: list[UploadFile] = File(...),
    folder: str = "",
    _: str = Depends(require_auth),
):
    target = MEDIA_DIR / folder if folder else MEDIA_DIR
    target.mkdir(parents=True, exist_ok=True)

    saved = []
    for file in files:
        ext = Path(file.filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue
        dest = target / file.filename
        if dest.exists():
            dest = target / f"{Path(file.filename).stem}_{uuid.uuid4().hex[:6]}{ext}"
        dest.write_bytes(await file.read())
        saved.append(dest.name)

    return {"uploaded": saved}
