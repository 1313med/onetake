# OneTake — AI Personal Video Production Studio

Ordinary people record. OneTake analyzes the **entire** source once, builds **5 creative timelines** (not chronological slices), and **renders 5 real MP4 files** with burned captions, grade, and music mix.

## Run (required two processes)

```bash
# 1) Render studio (Whisper + FFmpeg)
npm run studio

# 2) App
npx expo start --clear
```

Set API URL if the phone is not on localhost:

```bash
# Windows PowerShell example
$env:EXPO_PUBLIC_STUDIO_API="http://YOUR_LAN_IP:8787"
npx expo start --clear
```

## Pipeline

1. **Analyze** — ffprobe source  
2. **Transcribe** — faster-whisper (multilingual, word timestamps)  
3. **Dedupe** — collapse accidental repeated takes  
4. **Plan** — 5 independent creative timelines from the full transcript  
5. **Render** — FFmpeg cuts + concat + color grade + ASS captions + voice EQ/compress + music duck  
6. **QA** — probe each output (vertical, audio, duration, multi-clip, captions planned)  
7. **Deliver** — playable/downloadable MP4s in the studio UI  

## Tested locally

```bash
npm run studio
npm run studio:test
```

Produces 5 files under `server/jobs/<id>/version_*.mp4`.

## Stack

- Expo app (upload + progress + results UI)
- Node render server (`server/`)
- `@ffmpeg-installer/ffmpeg` + fluent-ffmpeg
- `faster-whisper` (Python)
