import React, { useState, useEffect } from 'react'
import type { QueueState } from '@kara/shared'

export default function Queue(): React.ReactElement {
  const [queue, setQueue] = useState<QueueState>({ items: [], nowPlaying: null, history: [] })
  const [partyActive, setPartyActive] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const startParty = async () => {
    const result = await (window as any).api.startParty()
    setPartyActive(true)
    setSessionId(result.sessionId)
  }

  const stopParty = async () => {
    await (window as any).api.stopParty()
    setPartyActive(false)
    setSessionId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Queue</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {partyActive && sessionId && (
            <span style={{ fontSize: 12, color: '#4af' }}>Party active · {sessionId.slice(0, 8)}</span>
          )}
          <button onClick={partyActive ? stopParty : startParty} style={btnStyle(partyActive)}>
            {partyActive ? 'Stop Party' : 'Start Party'}
          </button>
        </div>
      </div>

      {queue.nowPlaying && (
        <div style={{ background: '#1a1a1a', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#e05', fontWeight: 700, marginBottom: 4 }}>NOW PLAYING</div>
          <div style={{ fontWeight: 600 }}>{queue.nowPlaying.song.title}</div>
          <div style={{ color: '#888', fontSize: 13 }}>{queue.nowPlaying.song.artist}</div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {queue.items.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', marginTop: 40 }}>
            Queue is empty. Add songs from the Library.
          </div>
        ) : (
          queue.items.map((item, i) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid #1a1a1a',
              }}
            >
              <span style={{ color: '#555', width: 24, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{item.song.title}</div>
                <div style={{ fontSize: 13, color: '#888' }}>
                  {item.song.artist} · requested by {item.requestedBy}
                </div>
              </div>
              {item.skipVotes.length > 0 && (
                <span style={{ fontSize: 12, color: '#fa0' }}>{item.skipVotes.length} skip</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? '#333' : '#e05',
    border: 'none',
    color: '#fff',
    padding: '8px 18px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
  }
}
