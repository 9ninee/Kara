import { IpcMain } from 'electron'
import { request as httpsReq } from 'https'
import { request as httpReq } from 'http'

// ── Types ──────────────────────────────────────────────────────────────────

export interface KaraokeTrack {
  id: string
  title: string
  artist: string
  previewUrl?: string
  downloadUrl?: string
  coverUrl?: string
  duration?: number
  source: string
}

export interface IKaraokeProvider {
  readonly name: string
  search(query: string): Promise<KaraokeTrack[]>
  getDownloadUrl(trackId: string): Promise<string>
}

// ── HTTP helper (no DOM / fetch required) ─────────────────────────────────

function fetchJson(url: string): Promise<unknown> {
  const mod = url.startsWith('https') ? httpsReq : httpReq
  return new Promise((resolve, reject) => {
    const req = mod(url, { method: 'GET', headers: { 'Accept': 'application/json' } }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => { body += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(body)) }
        catch (e: unknown) { reject(e) }
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

// ── Generic REST adapter ───────────────────────────────────────────────────

export class GenericRestProvider implements IKaraokeProvider {
  constructor(
    public readonly name: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly searchPath = '/api/search',
    private readonly downloadPath = '/api/download',
  ) {}

  async search(query: string): Promise<KaraokeTrack[]> {
    const url = `${this.baseUrl}${this.searchPath}?q=${encodeURIComponent(query)}&key=${encodeURIComponent(this.apiKey)}`
    const data = await fetchJson(url) as { tracks?: KaraokeTrack[]; results?: KaraokeTrack[] }
    return data.tracks ?? data.results ?? []
  }

  async getDownloadUrl(trackId: string): Promise<string> {
    const url = `${this.baseUrl}${this.downloadPath}?id=${encodeURIComponent(trackId)}&key=${encodeURIComponent(this.apiKey)}`
    const data = await fetchJson(url) as { url?: string; downloadUrl?: string }
    const dlUrl = data.url ?? data.downloadUrl
    if (!dlUrl) throw new Error('No download URL in provider response')
    return dlUrl
  }
}

// ── Singleton provider ─────────────────────────────────────────────────────

let provider: IKaraokeProvider | null = null

export function configureProvider(baseUrl: string, apiKey: string, name = 'Karaoke API'): void {
  provider = new GenericRestProvider(name, baseUrl, apiKey)
}

export function getProvider(): IKaraokeProvider | null {
  return provider
}

// ── IPC handlers ───────────────────────────────────────────────────────────

export function registerKaraokeApiHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('karaoke-api:configure', (_e, baseUrl: string, apiKey: string, name?: string) => {
    configureProvider(baseUrl, apiKey, name)
    return { success: true }
  })

  ipcMain.handle('karaoke-api:search', async (_e, query: string): Promise<KaraokeTrack[]> => {
    if (!provider) return []
    return provider.search(query)
  })

  ipcMain.handle('karaoke-api:download', async (_e, trackId: string, title: string) => {
    if (!provider) throw new Error('No karaoke API configured')
    const dlUrl = await provider.getDownloadUrl(trackId)
    // Download via yt-dlp or direct fetch depending on URL
    return { url: dlUrl, title }
  })

  ipcMain.handle('karaoke-api:status', () => ({
    configured: !!provider,
    name: provider?.name ?? null,
  }))
}
