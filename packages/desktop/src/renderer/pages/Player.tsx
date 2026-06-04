import React, { useState, useEffect, useCallback } from 'react'
import { CDGPlayer, parseLRC } from '@kara/shared'
import type { Song, LyricsLine } from '@kara/shared'
import { CDGDisplay, LRCDisplay } from '../components/LyricsDisplay'
import { useAudioPlayer } from '../hooks/useAudioPlayer'

export default function Player(): React.ReactElement {
  const player = useAudioPlayer()
  const [cdgPlayer, setCdgPlayer] = useState<CDGPlayer | null>(null)
  const [lrcLines, setLrcLines] = useState<LyricsLine[]>([])
  const [currentSong, setCurrentSong] = useState<Song | null>(null)

  const loadSong = useCallback(
    async (song: Song) => {
      setCurrentSong(song)

      await player.loadTrack(song.audioPath)

      if (song.cdgPath) {
        const resp = await fetch(song.cdgPath)
        const buf = await resp.arrayBuffer()
        setCdgPlayer(new CDGPlayer(buf))
        setLrcLines([])
      } else if (song.lrcPath) {
        setCdgPlayer(null)
        const resp = await fetch(song.lrcPath)
        const text = await resp.text()
        setLrcLines(parseLRC(text))
      } else {
        setCdgPlayer(null)
        setLrcLines([])
      }
    },
    [player],
  )

  const { currentTimeMs, durationMs, isPlaying, volume, micVolume } = player.state
  const progressPct = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000' }}>
      {/* Lyrics / CDG display */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {cdgPlayer ? (
          <CDGDisplay cdgPlayer={cdgPlayer} currentTimeMs={currentTimeMs} />
        ) : lrcLines.length > 0 ? (
          <LRCDisplay lines={lrcLines} currentTimeMs={currentTimeMs} />
        ) : currentSong ? (
          <div style={{ textAlign: 'center', color: '#666' }}>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{currentSong.title}</div>
            <div style={{ fontSize: 20, marginTop: 8 }}>{currentSong.artist}</div>
          </div>
        ) : (
          <div style={{ color: '#555', fontSize: 18 }}>Select a song from the Library</div>
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
        {/* Progress bar */}
        <input
          type="range"
          min={0}
          max={durationMs || 1}
          value={currentTimeMs}
          onChange={(e) => player.seek(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#e05' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' }}>
          <span>{formatMs(currentTimeMs)}</span>
          <span>{formatMs(durationMs)}</span>
        </div>

        {/* Buttons + volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={isPlaying ? player.pause : player.play}
            disabled={!currentSong}
            style={btnStyle}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: '#aaa', width: 60 }}>Music</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => player.setVolume(Number(e.target.value))}
              style={{ accentColor: '#e05', width: 100 }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: '#aaa', width: 40 }}>Mic</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={micVolume}
              onChange={(e) => player.setMicVolume(Number(e.target.value))}
              style={{ accentColor: '#4af', width: 100 }}
            />
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
  padding: '8px 24px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 14,
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
