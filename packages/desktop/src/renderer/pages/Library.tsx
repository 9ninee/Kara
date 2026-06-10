import React, { useEffect, useState, useCallback, useRef } from 'react'
import type { Song } from '@kara/shared'
import { useAppContext } from '../context/AppContext'

declare global {
  interface Window {
    api: {
      getSongs: (query?: string) => Promise<Song[]>
      addSong: (paths: string[]) => Promise<Song[]>
      deleteSong: (id: string) => Promise<void>
      importFolder: (path: string) => Promise<Song[]>
      getLocalFileUrl: (absPath: string) => string
      showOpenDialog: (options: {
        title?: string
        filters?: { name: string; extensions: string[] }[]
        properties?: string[]
      }) => Promise<{ canceled: boolean; filePaths: string[] }>
      searchYoutube: (q: string) => Promise<YoutubeResult[]>
      downloadYoutube: (url: string, title: string) => Promise<string>
      searchKaraoke: (q: string) => Promise<KaraokeResult[]>
      downloadKaraoke: (trackId: string) => Promise<string>
      configureKaraokeApi: (baseUrl: string, apiKey: string) => Promise<unknown>
      discoverChromecast: () => Promise<unknown[]>
      castToChromecast: (d: unknown, path: string) => Promise<unknown>
      startParty: () => Promise<{ sessionId: string; port: number; qr: string }>
      stopParty: () => Promise<void>
      on: (channel: string, cb: (...args: unknown[]) => void) => void
      off: (channel: string, cb: (...args: unknown[]) => void) => void
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

interface KaraokeResult {
  id: string
  title: string
  artist: string
  duration: number
  previewUrl?: string
  source: string
}

type OnlineTab = 'youtube' | 'karaoke'

export default function Library(): React.ReactElement {
  const { playSong, currentSong } = useAppContext()
  const [songs, setSongs] = useState<Song[]>([])
  const [query, setQuery] = useState('')
  const [ytResults, setYtResults] = useState<YoutubeResult[]>([])
  const [karaokeResults, setKaraokeResults] = useState<KaraokeResult[]>([])
  const [onlineTab, setOnlineTab] = useState<OnlineTab>('youtube')
  const [searching, setSearching] = useState(false)
  const [downloads, setDownloads] = useState<Map<string, number>>(new Map())
  const downloadsCbRef = useRef<((...args: unknown[]) => void) | null>(null)

  const refresh = useCallback((q?: string) => {
    window.api.getSongs(q).then(setSongs)
  }, [])

  useEffect(() => {
    refresh()

    const cb = (...args: unknown[]) => {
      const { url, percent } = args[0] as { url: string; title: string; percent: number }
      setDownloads((prev) => new Map(prev).set(url, percent))
    }
    downloadsCbRef.current = cb
    window.api.on('download:progress', cb)
    return () => {
      if (downloadsCbRef.current) window.api.off('download:progress', downloadsCbRef.current)
    }
  }, [refresh])

  const handleImportFiles = async () => {
    const result = await window.api.showOpenDialog({
      title: 'Import Karaoke Files',
      filters: [{ name: 'MP3 Audio', extensions: ['mp3'] }, { name: 'All Files', extensions: ['*'] }],
      properties: ['openFile', 'multiSelections'],
    })
    if (!result.canceled && result.filePaths.length > 0) {
      await window.api.addSong(result.filePaths)
      refresh()
    }
  }

  const handleImportFolder = async () => {
    const result = await window.api.showOpenDialog({
      title: 'Import Karaoke Folder',
      properties: ['openDirectory'],
    })
    if (!result.canceled && result.filePaths.length > 0) {
      await window.api.importFolder(result.filePaths[0])
      refresh()
    }
  }

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const [yt, karaoke] = await Promise.allSettled([
        window.api.searchYoutube(query),
        window.api.searchKaraoke(query),
      ])
      if (yt.status === 'fulfilled') setYtResults(yt.value)
      if (karaoke.status === 'fulfilled') setKaraokeResults(karaoke.value)
    } finally {
      setSearching(false)
    }
  }

  const downloadYt = async (r: YoutubeResult) => {
    setDownloads((prev) => new Map(prev).set(r.url, 0))
    await window.api.downloadYoutube(r.url, r.title)
    setDownloads((prev) => { const m = new Map(prev); m.delete(r.url); return m })
    refresh()
  }

  const downloadKaraoke = async (r: KaraokeResult) => {
    setDownloads((prev) => new Map(prev).set(r.id, 0))
    await window.api.downloadKaraoke(r.id)
    setDownloads((prev) => { const m = new Map(prev); m.delete(r.id); return m })
    refresh()
  }

  const showOnline = ytResults.length > 0 || karaokeResults.length > 0

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Local library */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #222', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); refresh(e.target.value) }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search songs… (Enter to search online)"
            style={inputStyle}
          />
          <button onClick={handleImportFiles} style={btnSmall}>+ Files</button>
          <button onClick={handleImportFolder} style={{ ...btnSmall, background: '#226' }}>+ Folder</button>
          <button onClick={handleSearch} disabled={searching} style={{ ...btnSmall, background: '#c00' }}>
            {searching ? '…' : 'Search Online'}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {songs.map((song) => {
            const isActive = currentSong?.id === song.id
            return (
              <div
                key={song.id}
                onDoubleClick={() => playSong(song)}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid #1a1a1a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  background: isActive ? '#1a0a14' : 'transparent',
                  borderLeft: isActive ? '3px solid #e05' : '3px solid transparent',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: isActive ? '#e05' : '#fff' }}>{song.title}</div>
                  <div style={{ fontSize: 13, color: '#888' }}>{song.artist}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {song.cdgPath && <span style={badge('#4af', '#0a1a2a')}>CDG</span>}
                  {song.lrcPath && !song.cdgPath && <span style={badge('#8f8', '#0a2a0a')}>LRC</span>}
                  <span style={{ fontSize: 12, color: '#555' }}>{formatDuration(song.duration)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.api.deleteSong(song.id).then(() => refresh()) }}
                    style={{ background: 'transparent', border: 'none', color: '#c55', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
          {songs.length === 0 && (
            <div style={{ padding: 32, color: '#555', textAlign: 'center' }}>
              <div style={{ marginBottom: 8 }}>No songs yet.</div>
              <div style={{ fontSize: 13 }}>Click "+ Files" or "+ Folder" to import CDG+MP3 karaoke files.</div>
            </div>
          )}
        </div>
      </div>

      {/* Online results panel */}
      {showOnline && (
        <div style={{ width: 380, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #222' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
            {(['youtube', 'karaoke'] as OnlineTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setOnlineTab(tab)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  background: onlineTab === tab ? '#1a1a1a' : 'transparent',
                  border: 'none',
                  borderBottom: onlineTab === tab ? '2px solid #e05' : '2px solid transparent',
                  color: onlineTab === tab ? '#fff' : '#666',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {tab === 'youtube' ? `YouTube (${ytResults.length})` : `Karaoke API (${karaokeResults.length})`}
              </button>
            ))}
            <button
              onClick={() => { setYtResults([]); setKaraokeResults([]) }}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '0 12px', fontSize: 18 }}
            >
              ×
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {onlineTab === 'youtube' && ytResults.map((r) => {
              const pct = downloads.get(r.url)
              return (
                <div key={r.id} style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a', display: 'flex', gap: 10, alignItems: 'center' }}>
                  {r.thumbnail && (
                    <img src={r.thumbnail} alt="" style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>{r.uploader} · {formatDuration(r.duration)}</div>
                    {pct !== undefined && pct < 100 && (
                      <div style={{ marginTop: 4, height: 3, background: '#333', borderRadius: 2 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#c00', borderRadius: 2 }} />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => downloadYt(r)}
                    disabled={pct !== undefined && pct < 100}
                    style={{ ...btnSmall, fontSize: 12, flexShrink: 0, opacity: pct !== undefined && pct < 100 ? 0.5 : 1 }}
                  >
                    {pct !== undefined && pct < 100 ? `${Math.round(pct)}%` : '↓'}
                  </button>
                </div>
              )
            })}

            {onlineTab === 'karaoke' && (karaokeResults.length === 0 ? (
              <div style={{ padding: 24, color: '#555', textAlign: 'center', fontSize: 13 }}>
                Configure a Karaoke API in Settings to see results here.
              </div>
            ) : karaokeResults.map((r) => {
              const pct = downloads.get(r.id)
              return (
                <div key={r.id} style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>{r.artist} · {formatDuration(r.duration)}</div>
                    {pct !== undefined && pct < 100 && (
                      <div style={{ marginTop: 4, height: 3, background: '#333', borderRadius: 2 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#e05', borderRadius: 2 }} />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => downloadKaraoke(r)}
                    disabled={pct !== undefined && pct < 100}
                    style={{ ...btnSmall, fontSize: 12, flexShrink: 0, opacity: pct !== undefined && pct < 100 ? 0.5 : 1 }}
                  >
                    {pct !== undefined && pct < 100 ? `${Math.round(pct)}%` : '↓'}
                  </button>
                </div>
              )
            }))}
          </div>
        </div>
      )}
    </div>
  )
}

function badge(color: string, bg: string): React.CSSProperties {
  return { fontSize: 10, color, background: bg, padding: '1px 5px', borderRadius: 3 }
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 120,
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
  whiteSpace: 'nowrap',
}

function formatDuration(s: number): string {
  if (!s) return '--:--'
  return `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`
}
