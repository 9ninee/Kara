import { IpcMain, WebContents } from 'electron'
import { spawn, execFile } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { promisify } from 'util'
import { existsSync, mkdirSync } from 'fs'

const execFileAsync = promisify(execFile)

function getYtDlpPath(): string {
  const bundled = join(process.resourcesPath, 'yt-dlp')
  if (existsSync(bundled)) return bundled
  return 'yt-dlp'
}

export interface YTSearchResult {
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

export function downloadYoutube(url: string, title: string, webContents?: WebContents): Promise<string> {
  const ytDlp = getYtDlpPath()
  const outputDir = join(app.getPath('userData'), 'downloads')
  mkdirSync(outputDir, { recursive: true })
  const outputTemplate = join(outputDir, '%(title)s.%(ext)s')

  return new Promise((resolve, reject) => {
    const proc = spawn(ytDlp, [
      url,
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', outputTemplate,
      '--no-warnings',
      '--newline',
    ])

    let outPath = outputDir
    const progressRe = /\[download\]\s+([\d.]+)%/

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      const match = progressRe.exec(text)
      if (match && webContents && !webContents.isDestroyed()) {
        webContents.send('download:progress', { url, title, percent: parseFloat(match[1]) })
      }
      const destMatch = /\[ExtractAudio\] Destination: (.+)/.exec(text) ??
                        /\[download\] Destination: (.+)/.exec(text)
      if (destMatch) outPath = destMatch[1].trim()
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      if (!text.includes('WARNING')) reject(new Error(text.trim()))
    })

    proc.on('close', (code) => {
      if (webContents && !webContents.isDestroyed()) {
        webContents.send('download:progress', { url, title, percent: 100 })
      }
      if (code === 0) resolve(outPath)
      else reject(new Error(`yt-dlp exited with code ${code}`))
    })
  })
}

export function registerProviderHandlers(ipcMain: IpcMain, webContents?: WebContents): void {
  ipcMain.handle('provider:youtube-search', (_e, query: string) => searchYoutube(query))
  ipcMain.handle('provider:youtube-download', (e, url: string, title: string) =>
    downloadYoutube(url, title, webContents ?? e.sender),
  )
}
