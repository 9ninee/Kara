import React, { useEffect, useState, useCallback } from 'react'
import type { Song } from '@kara/shared'
import { useAppContext } from '../context/AppContext'

interface ChromecastDeviceInfo {
  id: string
  name: string
  host: string
  port: number
}

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
      setOutputDevice: (id: string) => Promise<unknown>
      setInputDevice: (id: string) => Promise<unknown>
      discoverChromecast: () => Promise<ChromecastDeviceInfo[]>
      castToChromecast: (d: ChromecastDeviceInfo, url: string) => Promise<{ success: boolean; error?: string }>
      castPause: () => Promise<void>
      castResume: () => Promise<void>
      castSeek: (secs: number) => Promise<void>
      stopCasting: () => Promise<void>
      getCastStatus: () => Promise<{ connected: boolean; device: ChromecastDeviceInfo | null }>
      startParty: () => Promise<{ sessionId: string; port: number; qrDataUrl: string }>
      stopParty: () => Promise<void>
      on: (channel: string, cb: (...args: unknown[]) => void) => () => void
      configureKaraokeApi: (baseUrl: string, apiKey: string, name: string) => Promise<{ success: boolean }>
      getKaraokeApiStatus: () => Promise<{ configured: boolean; name: string | null }>
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
  const { playSong, currentSong } = useAppContext()
  const [songs, setSongs] = useState<Song[]>([])
  const [query, setQuery] = useState('')
  const [ytResults, setYtResults] = useState<YoutubeResult[]>([])
  const [searching, setSearching] = useState(false)

  const refresh = useCallback((q?: string) => {
    window.api.getSongs(q)
      .then(setSongs)
      .catch((err: unknown) => console.warn('[Library] getSongs failed', err))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleImportFiles = async () => {
    const result = await window.api.showOpenDialog({
      title: 'Import Karaoke Files',
      filters: [
        { name: 'MP3 Audio', extensions: ['mp3'] },
        { name: 'All Files', extensions: ['*'] },
      ],
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #222', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              refresh(e.target.value)
            }}
            placeholder="Search songs…"
            style={inputStyle}
          />
          <button onClick={handleImportFiles} style={btnSmall} title="Import MP3 files">
            + Files
          </button>
          <button onClick={handleImportFolder} style={{ ...btnSmall, background: '#226' }} title="Import folder">
            + Folder
          </button>
          <button
            onClick={handleYoutubeSearch}
            disabled={searching}
            style={{ ...btnSmall, background: '#c00' }}
          >
            {searching ? '…' : 'YouTube'}
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
                  {song.cdgPath && (
                    <span style={{ fontSize: 10, color: '#4af', background: '#0a1a2a', padding: '1px 5px', borderRadius: 3 }}>
                      CDG
                    </span>
                  )}
                  {song.lrcPath && !song.cdgPath && (
                    <span style={{ fontSize: 10, color: '#8f8', background: '#0a2a0a', padding: '1px 5px', borderRadius: 3 }}>
                      LRC
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: '#555' }}>{formatDuration(song.duration)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      window.api.deleteSong(song.id)
                        .then(() => refresh())
                        .catch((err: unknown) => console.warn('[Library] deleteSong failed', err))
                    }}
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

      {/* YouTube results panel */}
      {ytResults.length > 0 && (
        <div style={{ width: 360, overflowY: 'auto', borderLeft: '1px solid #222' }}>
          <div style={{ padding: 12, borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#aaa', fontSize: 13 }}>YouTube Results</span>
            <button
              onClick={() => setYtResults([])}
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16 }}
            >
              ×
            </button>
          </div>
          {ytResults.map((r) => (
            <div
              key={r.id}
              style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a', display: 'flex', gap: 10, alignItems: 'center' }}
            >
              {r.thumbnail && (
                <img
                  src={r.thumbnail}
                  alt=""
                  style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title}
                </div>
                <div style={{ fontSize: 11, color: '#666' }}>{r.uploader}</div>
              </div>
              <button
                onClick={() => window.api.downloadYoutube(r.url, r.title)
                  .then(() => refresh())
                  .catch((err: unknown) => console.warn('[Library] downloadYoutube failed', err))}
                style={{ ...btnSmall, fontSize: 12, flexShrink: 0 }}
              >
                ↓
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
