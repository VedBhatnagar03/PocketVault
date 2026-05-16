from pathlib import Path

MEDIA_DIR = Path("media")
MEDIA_DIR.mkdir(exist_ok=True)

USERNAME = "vault"
PASSWORD = "changeme123"

SUPPORTED_IMAGES = {".jpg", ".jpeg", ".png", ".gif", ".heic", ".webp", ".bmp"}
SUPPORTED_VIDEOS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".wmv"}
SUPPORTED_EXTENSIONS = SUPPORTED_IMAGES | SUPPORTED_VIDEOS
