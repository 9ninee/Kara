import React, { useState, useEffect, useCallback } from 'react'

interface Song {
  id: string; title: string; artist: string; format: string; duration: number; source: string
}
interface Artist { id: string; name: string; play_count: number }
interface YTResult { id: string; title: string; uploader: string; duration: number; thumbnail: string; url: string }
interface USDBResult { id: string; title: string; artist: string; pageUrl: string }

interface Props {
  onAdd: (songId: string, singerName: string) => void
  singerName: string
}

type Tab = 'local' | 'youtube' | 'usdb'

export default function Library({ onAdd, singerName }: Props) {
  const [songs, setSongs] = useState<Song[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('local')
  const [ytResults, setYtResults] = useState<YTResult[]>([])
  const [usdbResults, setUsdbResults] = useState<USDBResult[]>([])
  const [searching, setSearching] = useState(false)
  const [dlProgress, setDlProgress] = useState<Map<string, number>>(new Map())

  const refreshLocal = useCallback(async (q?: string, artistId?: string | null) => {
    if (artistId) {
      const r = await fetch(`/api/library/artists/${artistId}/songs`)
      setSongs(await r.json())
    } else {
      const r = await fetch(`/api/library/songs${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      setSongs(await r.json())
    }
  }, [])

  const refreshArtists = useCallback(async () => {
    const r = await fetch('/api/library/artists')
    setArtists(await r.json())
  }, [])

  useEffect(() => { refreshLocal(); refreshArtists() }, [refreshLocal, refreshArtists])

  const searchOnline = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      if (tab === 'youtube') {
        const r = await fetch(`/api/sources/youtube?q=${encodeURIComponent(query)}`)
        setYtResults(await r.json())
      } else if (tab === 'usdb') {
        const r = await fetch(`/api/sources/usdb?q=${encodeURIComponent(query)}`)
        setUsdbResults(await r.json())
      }
    } finally { setSearching(false) }
  }

  const downloadYT = async (r: YTResult) => {
    setDlProgress(p => new Map(p).set(r.url, 0))
    const evtSource = new EventSource(`/api/sources/youtube/download?url=${encodeURIComponent(r.url)}&title=${encodeURIComponent(r.title)}`)
    // actually the route is POST — use fetch + SSE
    const resp = await fetch('/api/sources/youtube/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: r.url, title: r.title }),
    })
    const reader = resp.body!.getReader()
    const dec = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = dec.decode(value)
      for (const line of text.split('\n')) {
        if (line.startsWith('data:')) {
          const d = JSON.parse(line.slice(5))
          if (d.percent !== undefined) setDlProgress(p => new Map(p).set(r.url, d.percent))
          if (d.done) { refreshLocal(); refreshArtists() }
        }
      }
    }
    setDlProgress(p => { const m = new Map(p); m.delete(r.url); return m })
  }

  const localSongs = tab === 'local' ? songs : []

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Artist sidebar */}
      <div style={{ width: 160, borderRight: '1px solid #1a1a1a', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '10px 12px', fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>Artists</div>
        <div
          onClick={() => { setSelectedArtist(null); refreshLocal(query) }}
          style={{ padding: '8px 12px', cursor: 'pointer', background: !selectedArtist ? '#1a0a14' : 'transparent', color: !selectedArtist ? '#e05' : '#aaa', fontSize: 13 }}
        >All</div>
        {artists.map(a => (
          <div key={a.id} onClick={() => { setSelectedArtist(a.id); refreshLocal(undefined, a.id) }}
            style={{ padding: '7px 12px', cursor: 'pointer', background: selectedArtist === a.id ? '#1a0a14' : 'transparent', color: selectedArtist === a.id ? '#e05' : '#aaa', fontSize: 13, borderLeft: selectedArtist === a.id ? '2px solid #e05' : '2px solid transparent' }}>
            {a.name}
          </div>
        ))}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #1a1a1a', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={query}
            onChange={e => { setQuery(e.target.value); if (tab === 'local') refreshLocal(e.target.value) }}
            onKeyDown={e => e.key === 'Enter' && searchOnline()}
            placeholder={tab === 'local' ? 'Filter songs…' : 'Search (Enter)'}
            style={inputSt} />
          {(['local', 'youtube', 'usdb'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ ...tabBtn, background: tab === t ? '#e05' : '#1a1a1a', color: tab === t ? '#fff' : '#888' }}>
              {t === 'local' ? '📁 Local' : t === 'youtube' ? '▶ YouTube' : '🌐 USDB'}
            </button>
          ))}
          {tab !== 'local' && (
            <button onClick={searchOnline} disabled={searching} style={{ ...tabBtn, background: '#444' }}>
              {searching ? '…' : 'Search'}
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Local songs */}
          {tab === 'local' && localSongs.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #111', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{s.artist} · {fmtDur(s.duration)}</div>
              </div>
              <span style={badge(s.format)}>{s.format.toUpperCase()}</span>
              <button onClick={() => onAdd(s.id, singerName)} style={addBtn}>+ Queue</button>
            </div>
          ))}

          {/* YouTube results */}
          {tab === 'youtube' && ytResults.map(r => {
            const pct = dlProgress.get(r.url)
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #111', gap: 10 }}>
                {r.thumbnail && <img src={r.thumbnail} style={{ width: 56, height: 42, borderRadius: 4, objectFit: 'cover' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{r.uploader} · {fmtDur(r.duration)}</div>
                  {pct !== undefined && pct < 100 && <div style={{ marginTop: 4, height: 3, background: '#1a1a1a', borderRadius: 2 }}><div style={{ width: `${pct}%`, height: '100%', background: '#c00', borderRadius: 2 }} /></div>}
                </div>
                <button onClick={() => downloadYT(r)} disabled={pct !== undefined && pct < 100} style={{ ...addBtn, background: '#c00' }}>
                  {pct !== undefined && pct < 100 ? `${Math.round(pct)}%` : '↓'}
                </button>
              </div>
            )
          })}

          {/* USDB results */}
          {tab === 'usdb' && usdbResults.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #111', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{r.artist}</div>
              </div>
              <a href={r.pageUrl} target="_blank" rel="noopener noreferrer" style={{ ...addBtn, textDecoration: 'none', fontSize: 11 }}>USDB ↗</a>
            </div>
          ))}

          {tab === 'local' && localSongs.length === 0 && (
            <div style={{ padding: 32, color: '#444', textAlign: 'center' }}>
              <div style={{ fontSize: 32 }}>🎵</div>
              <div style={{ marginTop: 8 }}>No songs yet — go to Settings to import a folder</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const inputSt: React.CSSProperties = { flex: 1, minWidth: 120, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#fff', padding: '6px 10px', fontSize: 13 }
const tabBtn: React.CSSProperties = { border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }
const addBtn: React.CSSProperties = { background: '#e05', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }
function badge(fmt: string): React.CSSProperties { return { fontSize: 10, padding: '2px 5px', borderRadius: 3, background: fmt === 'cdg' ? '#0a1a2a' : fmt === 'mkv' ? '#1a0a2a' : '#0a2a0a', color: fmt === 'cdg' ? '#4af' : fmt === 'mkv' ? '#a4f' : '#8f8' } }
function fmtDur(s: number) { if (!s) return '--:--'; return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` }
