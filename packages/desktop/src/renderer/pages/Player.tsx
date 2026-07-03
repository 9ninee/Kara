import React from 'react'
import { CDGDisplay, LRCDisplay } from '../components/LyricsDisplay'
import { useAppContext } from '../context/AppContext'

export default function Player(): React.ReactElement {
  const { currentSong, player, cdgPlayer, lrcLines, songLoading: loading } = useAppContext()

  const { currentTimeMs, durationMs, isPlaying, volume, micVolume } = player.state

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000' }}>
      {/* Lyrics / CDG display */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ color: '#555', fontSize: 16 }}>Loading…</div>
        ) : cdgPlayer ? (
          <CDGDisplay cdgPlayer={cdgPlayer} currentTimeMs={currentTimeMs} />
        ) : lrcLines.length > 0 ? (
          <LRCDisplay lines={lrcLines} currentTimeMs={currentTimeMs} />
        ) : currentSong ? (
          <div style={{ textAlign: 'center', color: '#666' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#fff' }}>{currentSong.title}</div>
            <div style={{ fontSize: 20, marginTop: 8 }}>{currentSong.artist}</div>
          </div>
        ) : (
          <div style={{ color: '#555', fontSize: 18 }}>Double-click a song in the Library</div>
        )}
      </div>

      {/* Transport controls */}
      <div
        style={{
          padding: '12px 24px',
          background: '#111',
          borderTop: '1px solid #222',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {currentSong && (
          <div style={{ fontSize: 13, color: '#aaa', marginBottom: 2 }}>
            <span style={{ color: '#fff', fontWeight: 600 }}>{currentSong.title}</span>
            {' · '}
            <span>{currentSong.artist}</span>
          </div>
        )}

        <input
          type="range"
          min={0}
          max={durationMs || 1}
          value={currentTimeMs}
          onChange={(e) => player.seek(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#e05', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginTop: -4 }}>
          <span>{formatMs(currentTimeMs)}</span>
          <span>{formatMs(durationMs)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            onClick={isPlaying ? player.pause : player.play}
            disabled={!currentSong}
            style={{ ...btnStyle, opacity: currentSong ? 1 : 0.4 }}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: '#aaa', minWidth: 48 }}>Music</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => player.setVolume(Number(e.target.value))}
              style={{ accentColor: '#e05', width: 90 }}
            />
            <span style={{ color: '#666', fontSize: 11, minWidth: 28 }}>
              {Math.round(volume * 100)}%
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: '#aaa', minWidth: 28 }}>Mic</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={micVolume}
              onChange={(e) => player.setMicVolume(Number(e.target.value))}
              style={{ accentColor: '#4af', width: 90 }}
            />
            <span style={{ color: '#666', fontSize: 11, minWidth: 28 }}>
              {Math.round(micVolume * 100)}%
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: '#e05',
  border: 'none',
  color: '#fff',
  padding: '8px 20px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 14,
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
