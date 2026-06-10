import React, { useEffect, useRef } from 'react'
import { CDGPlayer } from '@kara/shared'
import type { LyricsLine } from '@kara/shared'
import { getCurrentLineIndex, getLineProgress } from '@kara/shared'

interface Props {
  songId: string | null
  format: string
  positionMs: number
  durationMs: number
  isPlaying: boolean
  cdgPlayer: CDGPlayer | null
  lrcLines: LyricsLine[]
  loading: boolean
  onEnded: () => void
  onSeek: (ms: number) => void
  onPlayPause: () => void
  audioRef: React.RefObject<HTMLAudioElement | null>
  singerName: string
}

export default function Player({ songId, format, positionMs, durationMs, isPlaying, cdgPlayer, lrcLines, loading, onEnded, onSeek, onPlayPause, audioRef, singerName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // CDG rendering
  useEffect(() => {
    if (!cdgPlayer || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    const state = cdgPlayer.seek(positionMs)
    const imageData = new ImageData(state.pixels, 288, 192)
    ctx.putImageData(imageData, 0, 0)
  }, [cdgPlayer, positionMs])

  // Sync audio element to server state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const diff = Math.abs(audio.currentTime * 1000 - positionMs)
    if (diff > 1000) audio.currentTime = positionMs / 1000
    if (isPlaying && audio.paused) audio.play().catch(() => {})
    if (!isPlaying && !audio.paused) audio.pause()
  }, [positionMs, isPlaying, audioRef])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.onended = onEnded
  }, [audioRef, onEnded])

  const activeIdx = getCurrentLineIndex(lrcLines, positionMs)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        {loading && <div style={{ color: '#555', fontSize: 16 }}>Loading…</div>}

        {!loading && cdgPlayer && (
          <canvas ref={canvasRef} width={288} height={192}
            style={{ imageRendering: 'pixelated', width: '100%', maxWidth: 864, height: 'auto' }} />
        )}

        {!loading && !cdgPlayer && lrcLines.length > 0 && (
          <div style={{ width: '100%', maxWidth: 700, padding: '0 24px', textAlign: 'center' }}>
            {lrcLines.slice(Math.max(0, activeIdx - 1), activeIdx + 3).map((line, i) => {
              const idx = Math.max(0, activeIdx - 1) + i
              const isCurrent = idx === activeIdx
              const progress = isCurrent ? getLineProgress(line, positionMs) : 0
              return (
                <div key={idx} style={{ fontSize: isCurrent ? 28 : 18, fontWeight: isCurrent ? 700 : 400, color: isCurrent ? '#fff' : '#555', marginBottom: 12, lineHeight: 1.3, transition: 'all .2s' }}>
                  {isCurrent ? (
                    <span>
                      <span style={{ color: '#e05' }}>{line.text.slice(0, Math.round(line.text.length * progress))}</span>
                      <span>{line.text.slice(Math.round(line.text.length * progress))}</span>
                    </span>
                  ) : line.text}
                </div>
              )
            })}
          </div>
        )}

        {!loading && !cdgPlayer && lrcLines.length === 0 && songId && (
          <div style={{ color: '#888', fontSize: 18 }}>♪ Playing — no lyrics available</div>
        )}

        {!songId && (
          <div style={{ textAlign: 'center', color: '#444' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎤</div>
            <div style={{ fontSize: 18 }}>Add songs to the queue to get started</div>
          </div>
        )}

        {singerName && (
          <div style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 13, color: '#666', background: 'rgba(0,0,0,.6)', padding: '4px 10px', borderRadius: 20 }}>
            {singerName}
          </div>
        )}
      </div>

      <div style={{ padding: '10px 20px', background: '#0f0f0f', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onPlayPause} style={ctrlBtn} disabled={!songId}>{isPlaying ? '⏸' : '▶'}</button>
        <span style={timeSt}>{fmtTime(positionMs)}</span>
        <input type="range" min={0} max={Math.max(durationMs, positionMs, 1)} value={positionMs}
          onChange={e => onSeek(Number(e.target.value))}
          disabled={!songId}
          style={{ flex: 1, accentColor: '#e05' }} />
        <span style={timeSt}>{durationMs > 0 ? fmtTime(durationMs) : '--:--'}</span>
      </div>
    </div>
  )
}

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const timeSt: React.CSSProperties = { fontSize: 11, color: '#555', fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'center' }

const ctrlBtn: React.CSSProperties = {
  background: '#e05', border: 'none', color: '#fff',
  width: 38, height: 38, borderRadius: 19, cursor: 'pointer', fontSize: 16,
}
