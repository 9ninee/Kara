import React, { useEffect, useState, useCallback } from 'react'
import type { Song } from '@kara/shared'

declare global {
  interface Window {
    api: {
      getSongs: (query?: string) => Promise<Song[]>
      addSong: (paths: string[]) => Promise<Song[]>
      deleteSong: (id: string) => Promise<void>
      importFolder: (path: string) => Promise<Song[]>
      searchYoutube: (q: string) => Promise<YoutubeResult[]>
      downloadYoutube: (url: string, title: string) => Promise<string>
    }
  }
}

interface YoutubeResult {
  id: string
  title: string
  uploader: string
  duration: number
  thumbnail: string
  url: string
}

export default function Library(): React.ReactElement {
  const [songs, setSongs] = useState<Song[]>([])
  const [query, setQuery] = useState('')
  const [ytResults, setYtResults] = useState<YoutubeResult[]>([])
  const [searching, setSearching] = useState(false)

  const refresh = useCallback((q?: string) => {
    window.api.getSongs(q).then(setSongs)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleYoutubeSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const results = await window.api.searchYoutube(query)
      setYtResults(results)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Local library */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #222' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #222', display: 'flex', gap: 8 }}>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); refresh(e.target.value) }}
            placeholder="Search songs..."
            style={inputStyle}
          />
          <button onClick={() => refresh(query)} style={btnSmall}>Search</button>
          <button onClick={handleYoutubeSearch} style={{ ...btnSmall, background: '#c00' }}>
            YouTube
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {songs.map((song) => (
            <div
              key={song.id}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid #1a1a1a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
              onDoubleClick={() => {/* TODO: load into player */}}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{song.title}</div>
                <div style={{ fontSize: 13, color: '#888' }}>{song.artist}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#555' }}>{formatDuration(song.duration)}</span>
                <button
                  onClick={() => window.api.deleteSong(song.id).then(() => refresh())}
                  style={{ background: 'transparent', border: 'none', color: '#c55', cursor: 'pointer', fontSize: 16 }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          {songs.length === 0 && (
            <div style={{ padding: 32, color: '#555', textAlign: 'center' }}>
              No songs yet. Import a folder or search YouTube.
            </div>
          )}
        </div>
      </div>

      {/* YouTube results */}
      {ytResults.length > 0 && (
        <div style={{ width: 360, overflowY: 'auto' }}>
          <div style={{ padding: 12, borderBottom: '1px solid #222', color: '#aaa', fontSize: 13 }}>
            YouTube Results
          </div>
          {ytResults.map((r) => (
            <div
              key={r.id}
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #1a1a1a',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              {r.thumbnail && (
                <img src={r.thumbnail} alt="" style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 4 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                <div style={{ fontSize: 11, color: '#666' }}>{r.uploader}</div>
              </div>
              <button
                onClick={() => window.api.downloadYoutube(r.url, r.title).then(() => refresh())}
                style={{ ...btnSmall, fontSize: 12 }}
              >
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 6,
  color: '#fff',
  padding: '6px 10px',
  fontSize: 14,
}

const btnSmall: React.CSSProperties = {
  background: '#e05',
  border: 'none',
  color: '#fff',
  padding: '6px 14px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s) % 60).padStart(2, '0')}`
}
