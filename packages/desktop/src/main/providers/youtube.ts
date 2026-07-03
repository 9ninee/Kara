import { IpcMain } from 'electron'
import { execFile } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { promisify } from 'util'
import { existsSync, mkdirSync } from 'fs'
import { insertSong } from '../library/database'
import type { Song } from '@kara/shared'

const execFileAsync = promisify(execFile)

function getYtDlpPath(): string {
  const bundled = join(process.resourcesPath, 'yt-dlp')
  if (existsSync(bundled)) return bundled
  return 'yt-dlp'
}

interface YTSearchResult {
  id: string
  title: string
  uploader: string
  duration: number
  thumbnail: string
  url: string
}

export async function searchYoutube(query: string): Promise<YTSearchResult[]> {
  const ytDlp = getYtDlpPath()
  const { stdout } = await execFileAsync(ytDlp, [
    `ytsearch10:${query} karaoke`,
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
  ])

  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const j = JSON.parse(line)
      return {
        id: j.id,
        title: j.title,
        uploader: j.uploader ?? j.channel ?? 'Unknown',
        duration: j.duration ?? 0,
        // --flat-playlist exposes a thumbnails array, not a thumbnail string
        thumbnail: j.thumbnail ?? j.thumbnails?.[0]?.url ?? '',
        url: `https://www.youtube.com/watch?v=${j.id}`,
      }
    })
}

export async function downloadYoutube(url: string, title: string): Promise<Song> {
  const ytDlp = getYtDlpPath()
  const outputDir = join(app.getPath('userData'), 'downloads')
  mkdirSync(outputDir, { recursive: true })
  const outputTemplate = join(outputDir, '%(title)s.%(ext)s')

  // --print after_move:filepath emits the final file path on stdout
  const { stdout } = await execFileAsync(ytDlp, [
    url,
    '-x',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '-o',
    outputTemplate,
    '--print',
    'after_move:filepath',
    '--no-simulate',
    '--no-warnings',
  ])

  const filePath = stdout.trim().split('\n').filter(Boolean).pop()
  if (!filePath || !existsSync(filePath)) {
    throw new Error('yt-dlp finished but no output file was reported')
  }

  return insertSong({
    title: title || filePath.split('/').pop()!.replace(/\.mp3$/i, ''),
    artist: 'YouTube',
    duration: 0,
    source: 'youtube',
    audioPath: filePath,
  })
}

export function registerProviderHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('provider:youtube-search', (_e, query: string) => searchYoutube(query))
  ipcMain.handle('provider:youtube-download', (_e, url: string, title: string) =>
    downloadYoutube(url, title),
  )
}
