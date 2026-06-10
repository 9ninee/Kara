// UltraStar DataBase (usdb.eu) — open, free karaoke song repository with 100k+ songs
// The public API is undocumented; we scrape the search endpoint.

export interface USDBResult {
  id: string
  title: string
  artist: string
  year?: number
  language?: string
  pageUrl: string
}

export async function searchUSDB(query: string): Promise<USDBResult[]> {
  const url = `https://usdb.eu/?m=songs&s=${encodeURIComponent(query)}&limit=20&format=json`
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Kara/1.0 (self-hosted karaoke server)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!resp.ok) return []
    const data = await resp.json() as any
    const rows: any[] = Array.isArray(data) ? data : (data.songs ?? data.data ?? [])
    return rows.map(r => ({
      id: String(r.id ?? r.song_id ?? ''),
      title: String(r.title ?? ''),
      artist: String(r.artist ?? ''),
      year: r.year ? Number(r.year) : undefined,
      language: r.language ?? undefined,
      pageUrl: `https://usdb.eu/?m=detail&id=${r.id ?? r.song_id}`,
    }))
  } catch {
    return []
  }
}
