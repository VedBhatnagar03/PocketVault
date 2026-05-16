from pathlib import Path
from app.core.config import SUPPORTED_IMAGES, SUPPORTED_VIDEOS, MEDIA_DIR
from fastapi import HTTPException


def get_media_type(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in SUPPORTED_IMAGES:
        return "image"
    if ext in SUPPORTED_VIDEOS:
        return "video"
    return "other"


def safe_resolve(path: str) -> Path:
    """Resolve a relative media path and guard against path traversal."""
    file_path = MEDIA_DIR / path
    try:
        file_path.resolve().relative_to(MEDIA_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
    return file_path
