import React, { useState } from 'react'
import type { QueueItem } from '../hooks/useSocket'

interface Props {
  items: QueueItem[]
  nowPlaying: { item: QueueItem; positionMs: number; isPlaying: boolean } | null
  history: QueueItem[]
  singerName: string
  onSkipVote: (itemId: string) => void
  onForceSkip: () => void
  onRemove: (itemId: string) => void
  connectedCount: number
}

export default function Queue({ items, nowPlaying, history, singerName, onSkipVote, onForceSkip, onRemove, connectedCount }: Props) {
  const [showHistory, setShowHistory] = useState(false)

  const skipThreshold = Math.ceil(connectedCount / 2)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Now Playing */}
      {nowPlaying && (
        <div style={{ padding: '12px 16px', background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 10, color: '#e05', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>Now Playing</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nowPlaying.item.song.title}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{nowPlaying.item.song.artist} · {nowPlaying.item.singerName}</div>
              <div style={{ marginTop: 6, height: 3, background: '#1a1a1a', borderRadius: 2 }}>
                <div style={{ width: `${nowPlaying.item.song.duration ? (nowPlaying.positionMs / 1000 / nowPlaying.item.song.duration) * 100 : 0}%`, height: '100%', background: '#e05', borderRadius: 2, transition: 'width .5s linear' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
              <button onClick={onForceSkip} style={skipBtn} title="Force skip">⏭</button>
              <div style={{ fontSize: 10, color: '#555', textAlign: 'center' }}>
                {nowPlaying.item.skipVotes.length}/{skipThreshold}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Up Next header */}
      <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase', flex: 1 }}>
          Up Next ({items.length})
        </span>
        <button onClick={() => setShowHistory(h => !h)} style={ghostBtn}>
          {showHistory ? 'Hide History' : 'History'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {items.length === 0 && !showHistory && (
          <div style={{ padding: 40, textAlign: 'center', color: '#444' }}>
            <div style={{ fontSize: 36 }}>🎤</div>
            <div style={{ marginTop: 8 }}>Queue is empty — add songs from the Library</div>
          </div>
        )}

        {!showHistory && items.map((item, idx) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #0f0f0f', gap: 10 }}>
            <div style={{ width: 22, textAlign: 'center', fontSize: 12, color: '#333', flexShrink: 0 }}>{idx + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{item.song.title}</div>
              <div style={{ fontSize: 11, color: '#666' }}>{item.song.artist} · <span style={{ color: item.singerName === singerName ? '#e05' : '#666' }}>{item.singerName}</span></div>
            </div>
            <span style={fmtBadge(item.song.format)}>{item.song.format.toUpperCase()}</span>
            {item.singerName === singerName ? (
              <button onClick={() => onRemove(item.id)} style={{ ...ghostBtn, color: '#c44' }}>✕</button>
            ) : (
              <button
                onClick={() => onSkipVote(item.id)}
                title={`Vote to skip (${item.skipVotes.length}/${skipThreshold})`}
                style={{ ...ghostBtn, color: item.skipVotes.includes(singerName) ? '#e05' : '#444' }}
              >
                ⏭ {item.skipVotes.length > 0 && <span style={{ fontSize: 10 }}>{item.skipVotes.length}</span>}
              </button>
            )}
          </div>
        ))}

        {showHistory && (
          <>
            <div style={{ padding: '8px 16px', fontSize: 11, color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>Played</div>
            {history.length === 0 && <div style={{ padding: '12px 16px', color: '#444', fontSize: 13 }}>Nothing played yet.</div>}
            {history.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '7px 16px', borderBottom: '1px solid #0f0f0f', gap: 10, opacity: 0.5 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.song.title}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>{item.song.artist} · {item.singerName}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

const skipBtn: React.CSSProperties = { background: '#1a1a1a', border: 'none', color: '#888', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 14 }
const ghostBtn: React.CSSProperties = { background: 'transparent', border: '1px solid #222', color: '#666', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, flexShrink: 0 }
function fmtBadge(fmt: string): React.CSSProperties {
  return { fontSize: 9, padding: '2px 4px', borderRadius: 3, background: fmt === 'cdg' ? '#0a1a2a' : fmt === 'mkv' ? '#1a0a2a' : '#0a2a0a', color: fmt === 'cdg' ? '#4af' : fmt === 'mkv' ? '#a4f' : '#8f8', flexShrink: 0 }
}
