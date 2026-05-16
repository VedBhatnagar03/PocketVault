from fastapi import APIRouter, Depends
from app.core.auth import require_auth
from app.core.config import MEDIA_DIR

router = APIRouter(prefix="/api/folder", tags=["folders"])


@router.post("")
def create_folder(name: str, parent: str = "", _: str = Depends(require_auth)):
    target = MEDIA_DIR / parent / name if parent else MEDIA_DIR / name
    target.mkdir(parents=True, exist_ok=True)
    return {"created": str(target.relative_to(MEDIA_DIR)).replace("\\", "/")}
