import { IpcMain } from 'electron'
import { execFile } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { promisify } from 'util'
import { existsSync } from 'fs'

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
        thumbnail: j.thumbnail ?? '',
        url: `https://www.youtube.com/watch?v=${j.id}`,
      }
    })
}

export async function downloadYoutube(url: string, title: string): Promise<string> {
  const ytDlp = getYtDlpPath()
  const outputDir = join(app.getPath('userData'), 'downloads')
  const outputTemplate = join(outputDir, '%(title)s.%(ext)s')

  await execFileAsync(ytDlp, [
    url,
    '-x',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '-o',
    outputTemplate,
    '--no-warnings',
  ])

  return outputDir
}

export function registerProviderHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('provider:youtube-search', (_e, query: string) => searchYoutube(query))
  ipcMain.handle('provider:youtube-download', (_e, url: string, title: string) =>
    downloadYoutube(url, title),
  )
}
