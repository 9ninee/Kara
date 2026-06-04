import React, { useRef, useEffect } from 'react'
import { CDGPlayer, CDG_WIDTH, CDG_HEIGHT, getCurrentLineIndex, getLineProgress } from '@kara/shared'
import type { LyricsLine } from '@kara/shared'

interface CDGDisplayProps {
  cdgPlayer: CDGPlayer
  currentTimeMs: number
}

export function CDGDisplay({ cdgPlayer, currentTimeMs }: CDGDisplayProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const state = cdgPlayer.seek(currentTimeMs)
    const imageData = new ImageData(state.pixels, CDG_WIDTH, CDG_HEIGHT)
    ctx.putImageData(imageData, 0, 0)
  }, [cdgPlayer, currentTimeMs])

  return (
    <canvas
      ref={canvasRef}
      width={CDG_WIDTH}
      height={CDG_HEIGHT}
      style={{ width: '100%', height: '100%', imageRendering: 'pixelated', background: '#000' }}
    />
  )
}

interface LRCDisplayProps {
  lines: LyricsLine[]
  currentTimeMs: number
}

export function LRCDisplay({ lines, currentTimeMs }: LRCDisplayProps): React.ReactElement {
  const activeIdx = getCurrentLineIndex(lines, currentTimeMs)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 16,
        padding: '0 32px',
      }}
    >
      {lines.slice(Math.max(0, activeIdx - 1), activeIdx + 3).map((line, i) => {
        const idx = Math.max(0, activeIdx - 1) + i
        const isActive = idx === activeIdx
        const progress = isActive ? getLineProgress(line, currentTimeMs) : 0
        return (
          <div
            key={idx}
            style={{
              fontSize: isActive ? 36 : 24,
              fontWeight: isActive ? 700 : 400,
              color: isActive ? '#fff' : '#888',
              textAlign: 'center',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${progress * 100}%`,
                  overflow: 'hidden',
                  color: '#e05',
                  whiteSpace: 'nowrap',
                }}
              >
                {line.text}
              </span>
            )}
            {line.text}
          </div>
        )
      })}
    </div>
  )
}
