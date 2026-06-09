import { IpcMain } from 'electron'
import { join } from 'path'
import { app } from 'electron'
import { mkdir, writeFile } from 'fs/promises'

export interface KaraokeResult {
  id: string
  title: string
  artist: string
  duration: number
  previewUrl?: string
  source: string
}

export interface IKaraokeProvider {
  search(query: string): Promise<KaraokeResult[]>
  download(trackId: string): Promise<string>
}

export class RestKaraokeAdapter implements IKaraokeProvider {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  async search(query: string): Promise<KaraokeResult[]> {
    const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&key=${encodeURIComponent(this.apiKey)}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!resp.ok) throw new Error(`API error ${resp.status}`)
    const data = await resp.json()

    // Normalise a common REST response shape — arrays of tracks with id/title/artist/duration
    const items: unknown[] = Array.isArray(data) ? data : (data.tracks ?? data.results ?? data.data ?? [])
    return items.map((item: any) => ({
      id: String(item.id ?? item.track_id ?? ''),
      title: String(item.title ?? item.name ?? ''),
      artist: String(item.artist ?? item.artist_name ?? ''),
      duration: Number(item.duration ?? 0),
      previewUrl: item.preview_url ?? item.previewUrl ?? undefined,
      source: this.baseUrl,
    }))
  }

  async download(trackId: string): Promise<string> {
    const url = `${this.baseUrl}/download/${encodeURIComponent(trackId)}?key=${encodeURIComponent(this.apiKey)}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(60000) })
    if (!resp.ok) throw new Error(`Download error ${resp.status}`)

    const outputDir = join(app.getPath('userData'), 'downloads')
    await mkdir(outputDir, { recursive: true })
    const ext = resp.headers.get('content-type')?.includes('zip') ? 'zip' : 'mp3'
    const outPath = join(outputDir, `karaoke-${trackId}.${ext}`)
    const buf = Buffer.from(await resp.arrayBuffer())
    await writeFile(outPath, buf)
    return outPath
  }
}

let adapter: RestKaraokeAdapter | null = null

export function setKaraokeProvider(baseUrl: string, apiKey: string): void {
  adapter = baseUrl ? new RestKaraokeAdapter(baseUrl, apiKey) : null
}

export function registerKaraokeApiHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('karaoke:search', async (_e, query: string): Promise<KaraokeResult[]> => {
    if (!adapter) return []
    return adapter.search(query)
  })

  ipcMain.handle('karaoke:download', async (_e, trackId: string): Promise<string> => {
    if (!adapter) throw new Error('Karaoke API not configured')
    return adapter.download(trackId)
  })

  ipcMain.handle('karaoke:configure', (_e, baseUrl: string, apiKey: string) => {
    setKaraokeProvider(baseUrl, apiKey)
    return { success: true }
  })
}
