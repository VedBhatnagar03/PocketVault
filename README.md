# PocketVault

Self-hosted personal media server. Store photos and videos on your laptop, access them from your iPhone via a native app or browser — no cloud required.

## Stack

| Part | Tech |
|---|---|
| Laptop server | Python + FastAPI |
| Remote access | Tailscale |
| iOS app | React Native (Expo) |

## Project Structure

```
pocket-vault/
├── server/                  # FastAPI backend
│   ├── app/
│   │   ├── main.py          # App entry point + router registration
│   │   ├── core/
│   │   │   ├── config.py    # Settings (credentials, paths, supported types)
│   │   │   ├── auth.py      # HTTP Basic auth dependency
│   │   │   └── utils.py     # Shared helpers (media type, path safety)
│   │   └── routes/
│   │       ├── media.py     # Browse + stream + delete endpoints
│   │       ├── upload.py    # File upload endpoint
│   │       └── folders.py   # Folder creation endpoint
│   ├── static/
│   │   └── index.html       # Mobile-friendly web UI
│   ├── media/               # Your photos/videos live here (gitignored)
│   ├── requirements.txt
│   └── start.bat            # Windows one-click start
└── mobile/                  # Expo React Native app (coming soon)
```

## Running the Server

```bash
cd server
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Or double-click `start.bat` on Windows.

Open `http://localhost:8000` — default login is `vault` / `changeme123`.  
**Change credentials in `server/app/core/config.py` before use.**

## Remote Access (Tailscale)

1. Install [Tailscale](https://tailscale.com) on your laptop and iPhone
2. Get your laptop's Tailscale IP (e.g. `100.x.x.x`)
3. Open `http://100.x.x.x:8000` on your phone from anywhere
