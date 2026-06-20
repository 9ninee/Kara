import React, { useState, useEffect, useCallback } from 'react'
import type { QueueState } from '@kara/shared'

export default function Queue(): React.ReactElement {
  const [queue, setQueue] = useState<QueueState>({ items: [], nowPlaying: null, history: [] })
  const [partyActive, setPartyActive] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const startParty = useCallback(async () => {
    try {
      const result = await window.api.startParty()
      setPartyActive(true)
      setSessionId(result.sessionId)
      setQrDataUrl(result.qrDataUrl || null)
    } catch (err: unknown) {
      console.error('[Queue] startParty failed', err)
    }
  }, [])

  const stopParty = useCallback(async () => {
    try {
      await window.api.stopParty()
    } catch (err: unknown) {
      console.error('[Queue] stopParty failed', err)
    }
    setPartyActive(false)
    setSessionId(null)
    setQrDataUrl(null)
    setQueue({ items: [], nowPlaying: null, history: [] })
  }, [])

  // Subscribe to real-time queue updates pushed from the main process
  useEffect(() => {
    const unsub = window.api.on('queue:updated', (q) => {
      setQueue(q as QueueState)
    })
    return () => { unsub() }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Queue</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {partyActive && sessionId && (
            <span style={{ fontSize: 12, color: '#4af' }}>Party · {sessionId.slice(0, 8)}</span>
          )}
          <button onClick={partyActive ? stopParty : startParty} style={partyActive ? btnSecondary : btnPrimary}>
            {partyActive ? 'Stop Party' : 'Start Party'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Queue list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 16px' }}>
          {queue.nowPlaying && (
            <div style={{ margin: '16px 20px 0', background: '#1a1a1a', borderRadius: 10, padding: '12px 16px', borderLeft: '3px solid #e05' }}>
              <div style={{ fontSize: 11, color: '#e05', fontWeight: 700, marginBottom: 4 }}>NOW PLAYING</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{queue.nowPlaying.song.title}</div>
              <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>{queue.nowPlaying.song.artist}</div>
              {queue.nowPlaying.isPlaying && (
                <div style={{ color: '#4af', fontSize: 12, marginTop: 4 }}>Playing…</div>
              )}
            </div>
          )}

          {queue.items.length === 0 && !queue.nowPlaying ? (
            <div style={{ color: '#555', textAlign: 'center', marginTop: 48, fontSize: 15 }}>
              {partyActive
                ? 'Queue is empty. Guests can add songs via the QR code.'
                : 'Start a party to let guests add songs.'}
            </div>
          ) : (
            queue.items.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid #1a1a1a' }}>
                <span style={{ color: '#555', width: 22, textAlign: 'right', flexShrink: 0, fontSize: 13 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{item.song.title}</div>
                  <div style={{ fontSize: 13, color: '#888' }}>
                    {item.song.artist} · by {item.requestedBy}
                  </div>
                </div>
                {item.skipVotes.length > 0 && (
                  <span style={{ fontSize: 12, color: '#fa0', background: '#1a1500', padding: '2px 6px', borderRadius: 4 }}>
                    {item.skipVotes.length} skip
                  </span>
                )}
              </div>
            ))
          )}

          {queue.history.length > 0 && (
            <div style={{ padding: '24px 20px 0' }}>
              <div style={{ fontSize: 11, color: '#555', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>
                Played ({queue.history.length})
              </div>
              {queue.history.map((h) => (
                <div key={h.queueItemId} style={{ fontSize: 13, color: '#444', padding: '4px 0', borderBottom: '1px solid #111' }}>
                  {h.songId}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QR code panel */}
        {partyActive && qrDataUrl && (
          <div style={{ width: 200, borderLeft: '1px solid #222', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, gap: 10 }}>
            <div style={{ fontSize: 11, color: '#888', textAlign: 'center', fontWeight: 600 }}>
              SCAN TO JOIN
            </div>
            <img
              src={qrDataUrl}
              alt="QR code to join party"
              style={{ width: 160, height: 160, imageRendering: 'pixelated' }}
            />
            <div style={{ fontSize: 11, color: '#555', textAlign: 'center' }}>
              {sessionId?.slice(0, 8)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  background: '#e05',
  border: 'none',
  color: '#fff',
  padding: '8px 18px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
}

const btnSecondary: React.CSSProperties = {
  background: '#333',
  border: 'none',
  color: '#f66',
  padding: '8px 18px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
}
