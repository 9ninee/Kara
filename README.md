# Kara 🎤

Open-source, self-hosted karaoke for your living room. One person runs the
server; everyone else joins from their phone browser by scanning a QR code —
no app installs.

## Quick start

Requirements: **Node.js 22+** and **pnpm** (`corepack enable`).
Optional: `ffmpeg`/`ffprobe` (MKV extraction + song durations), `yt-dlp` (YouTube downloads).

```bash
pnpm install
pnpm start          # builds shared + web + server, then launches
```

The server prints a QR code in the terminal — scan it from any phone on the
same Wi-Fi to join. The host opens the same URL on the machine connected to
the TV/speakers.

For development (auto-reload):

```bash
pnpm --filter @kara/web build   # the server serves the built web client
pnpm dev:server
```

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP + WebSocket port |
| `KARA_DATA` | `./.kara-data` | Database, uploads, downloads |
| `KARA_MUSIC_DIR` | — | Folder scanned at startup and watched for new songs |
| `FFMPEG_PATH` | `ffmpeg` | Custom FFmpeg binary |

## Adding songs

Point Kara at a folder (Settings → Scan folder, or `KARA_MUSIC_DIR`). Files
named `Artist - Title.ext` are categorised by artist automatically.

| You have | Kara plays |
|---|---|
| `Song.mp3` + `Song.cdg` | CD+G graphics rendered on canvas |
| `Song.mp3` + `Song.lrc` | Scrolling synced lyrics with karaoke highlight |
| `Song.mp3` + `Song.ksc` | KSC-timestamped lyrics |
| `Song.mkv` | Audio + subtitles extracted via FFmpeg |
| YouTube tab | Search + download karaoke videos via yt-dlp |
| USDB tab | Search UltraStar DataBase (usdb.eu) |

Audio formats: mp3, m4a, ogg, flac, wav. Re-scans are idempotent.

## Party features

- **Fair rotation queue** — each singer gets one turn per round, no matter
  how many songs anyone queues.
- **Skip voting** — more than half the connected people voting skip moves to
  the next song; upcoming songs can be voted out too.
- **Live sync** — queue, playback position, and play/pause state update on
  every device in real time.
- **Singer history** — every performance is recorded per singer name.

## Casting & microphone

- **TV via AirPlay / Bluetooth**: pair the speaker/TV at OS level, then pick
  it as the audio output in Settings (uses browser `setSinkId`).
- **TV via Chromecast**: use the browser's built-in Cast button to mirror the
  player tab.
- **Microphone**: enable in Settings — the mic is mixed through your chosen
  output with adjustable gain (Web Audio passthrough), so a phone with a
  headset can act as a wireless mic.

## Repository layout

| Package | What it is |
|---|---|
| `packages/server` | Node.js server — Express + Socket.IO, SQLite library, media streaming, yt-dlp/USDB sources, mDNS + QR discovery |
| `packages/web` | React PWA served by the server — player (CDG/LRC), library, queue, settings |
| `packages/shared` | CDG + LRC parsers, timing utilities (used by all apps) |
| `packages/desktop` | Electron app (standalone desktop player) |
| `packages/mobile` | React Native / Expo app (iOS) |
