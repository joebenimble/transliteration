# Speech-to-Text Web Application

A password-protected web app that transcribes uploaded `.wav` files using OpenAI Whisper. Upload multiple files, review draft transcriptions in a memo log, edit them, and submit batches to `transcriptions.txt`.

## Features

- Multi-file `.wav` upload (under 60 seconds each)
- Server-side Whisper transcription (`tiny` model)
- Memo log: review up to 10 pending transcriptions at a time
- In-browser audio playback and editable transcriptions
- Batch submit appends to `transcriptions.txt` and removes source WAVs
- Simple shared-password authentication

## Prerequisites

- Node.js 20+
- FFmpeg (`ffprobe` for duration checks)
- Python 3 with `openai-whisper` installed (`pip install openai-whisper`)

## Local development

```bash
npm install
export APP_PASSWORD=your-password
export SESSION_SECRET=some-random-secret
npm start
```

Open http://localhost:3000 and sign in with `APP_PASSWORD`.

### GitHub Codespaces

The repo includes a devcontainer-friendly setup. In a Codespace:

```bash
sudo apt-get update && sudo apt-get install -y ffmpeg python3-pip
pip3 install openai-whisper
npm install
APP_PASSWORD=devpassword SESSION_SECRET=devsecret npm start
```

Whisper runs via `python3 -m whisper` (no need for the `whisper` CLI to be on PATH).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_PASSWORD` | Yes (production) | Shared login password |
| `SESSION_SECRET` | Yes (production) | Session signing secret |
| `PORT` | No | HTTP port (default `3000`) |
| `DATA_DIR` | No | Data storage path (default `./data`) |
| `NODE_ENV` | No | Set to `production` for production deploys |
| `COOKIE_SECURE` | No | Set to `true` when serving over HTTPS (Railway/Render). Leave unset for `http://localhost` |

## Docker

```bash
docker build -t speech-to-text .
docker run -p 3000:3000 \
  -e APP_PASSWORD=your-password \
  -e SESSION_SECRET=your-secret \
  -v speech-data:/app/data \
  speech-to-text
```

## Deploy (Railway / Render)

1. Connect this repository
2. Use the included `Dockerfile`
3. Set `APP_PASSWORD` and `SESSION_SECRET`
4. Attach a persistent volume at `/app/data`
5. Health check path: `/health`

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth) |
| POST | `/login` | Sign in |
| POST | `/logout` | Sign out |
| POST | `/api/upload` | Upload multiple `.wav` files |
| GET | `/api/status` | Queue and pending memo counts |
| GET | `/api/memos` | Current memo page |
| PATCH | `/api/memos/:id` | Save edited transcription |
| POST | `/api/memos/submit` | Submit current page batch |
| GET | `/api/audio/:id` | Stream source WAV |
| GET | `/api/transcriptions` | Download `transcriptions.txt` |

## Data storage

All persistent data lives under `data/`:

- `data/uploads/` — uploaded WAV files (until submitted)
- `data/pending-memos.json` — draft transcriptions
- `data/transcriptions.txt` — submitted transcriptions

## License

MIT
