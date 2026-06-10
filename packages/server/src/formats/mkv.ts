import { execFile } from 'child_process'
import { promisify } from 'util'
import { join, dirname, basename, extname } from 'path'
import { existsSync } from 'fs'

const execFileAsync = promisify(execFile)

function ffmpegPath(): string {
  return process.env.FFMPEG_PATH ?? 'ffmpeg'
}

export async function extractMkv(mkvPath: string): Promise<{ audioPath: string; subtitlePath: string | null }> {
  const dir = dirname(mkvPath)
  const base = basename(mkvPath, extname(mkvPath))
  const audioPath = join(dir, `${base}.mp3`)
  const subtitlePath = join(dir, `${base}.ass`)

  if (!existsSync(audioPath)) {
    await execFileAsync(ffmpegPath(), [
      '-i', mkvPath,
      '-vn', '-acodec', 'mp3', '-q:a', '2',
      '-y', audioPath,
    ])
  }

  let subPath: string | null = null
  if (!existsSync(subtitlePath)) {
    try {
      await execFileAsync(ffmpegPath(), [
        '-i', mkvPath,
        '-map', '0:s:0',
        '-y', subtitlePath,
      ])
      subPath = subtitlePath
    } catch {
      subPath = null
    }
  } else {
    subPath = subtitlePath
  }

  return { audioPath, subtitlePath: subPath }
}

export async function probeMediaDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet', '-print_format', 'json', '-show_format', filePath,
    ])
    const data = JSON.parse(stdout)
    return Math.round(parseFloat(data.format?.duration ?? '0'))
  } catch {
    return 0
  }
}

export function parseKsc(text: string): Array<{ startMs: number; endMs: number; text: string }> {
  const lines: Array<{ startMs: number; endMs: number; text: string }> = []
  // KSC format: [HH:MM:SS:FF] Lyric text  (frame-accurate, 25fps assumed)
  const re = /\[(\d{2}):(\d{2}):(\d{2})[:.:](\d{2,3})\]\s*(.*)/
  const entries: { ms: number; text: string }[] = []

  for (const line of text.split('\n')) {
    const m = re.exec(line.trim())
    if (!m) continue
    const h = parseInt(m[1]), min = parseInt(m[2]), s = parseInt(m[3]), f = parseInt(m[4])
    const ms = (h * 3600 + min * 60 + s) * 1000 + (m[4].length === 3 ? f : Math.round(f * 40))
    entries.push({ ms, text: m[5] })
  }

  for (let i = 0; i < entries.length; i++) {
    lines.push({
      startMs: entries[i].ms,
      endMs: entries[i + 1]?.ms ?? entries[i].ms + 4000,
      text: entries[i].text,
    })
  }
  return lines
}
