import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { addSong } from '../library/database.js'

const execFileAsync = promisify(execFile)

function ytDlpPath(): string {
  const bundled = join(process.cwd(), 'resources', 'yt-dlp')
  return existsSync(bundled) ? bundled : 'yt-dlp'
}

export interface YTResult {
  id: string
  title: string
  uploader: string
  duration: number
  thumbnail: string
  url: string
}

export async function searchYoutube(query: string): Promise<YTResult[]> {
  const { stdout } = await execFileAsync(ytDlpPath(), [
    `ytsearch10:${query} karaoke`, '--dump-json', '--flat-playlist', '--no-warnings',
  ])
  return stdout.trim().split('\n').filter(Boolean).map(line => {
    const j = JSON.parse(line)
    return {
      id: j.id,
      title: j.title,
      uploader: j.uploader ?? j.channel ?? 'Unknown',
      duration: j.duration ?? 0,
      thumbnail: j.thumbnail ?? '',
      url: `https://www.youtube.com/watch?v=${j.id}`,
    }
  })
}

export function downloadYoutube(
  url: string,
  title: string,
  downloadDir: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  mkdirSync(downloadDir, { recursive: true })
  const template = join(downloadDir, '%(title)s.%(ext)s')

  return new Promise((resolve, reject) => {
    const proc = spawn(ytDlpPath(), [
      url, '-x', '--audio-format', 'mp3', '--audio-quality', '0',
      '-o', template, '--no-warnings', '--newline',
    ])

    let outPath = downloadDir
    const pctRe = /\[download\]\s+([\d.]+)%/
    const destRe = /(?:\[ExtractAudio\]|\[download\]) Destination: (.+)/

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      const m = pctRe.exec(text)
      if (m) onProgress?.(parseFloat(m[1]))
      const d = destRe.exec(text)
      if (d) outPath = d[1].trim()
    })

    proc.on('close', code => {
      onProgress?.(100)
      if (code === 0) {
        // Auto-index into library
        const parts = title.split(' - ')
        const artist = parts.length > 1 ? parts[0].trim() : 'YouTube'
        const songTitle = parts.length > 1 ? parts.slice(1).join(' - ').trim() : title
        try {
          addSong({ title: songTitle, artist, duration: 0, source: 'youtube', audio_path: outPath, video_path: null, cdg_path: null, lrc_path: null, subtitle_path: null, cover_url: null, format: 'lrc' })
        } catch { /* duplicate */ }
        resolve(outPath)
      } else {
        reject(new Error(`yt-dlp exited ${code}`))
      }
    })
  })
}
