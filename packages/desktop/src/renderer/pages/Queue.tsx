import React, { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import type { QueueState, ServerToClientEvents, ClientToServerEvents } from '@kara/shared'
import { useAppContext } from '../context/AppContext'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

export default function Queue(): React.ReactElement {
  const { currentSong } = useAppContext()
  const [queue, setQueue] = useState<QueueState>({ items: [], nowPlaying: null, history: [] })
  const [partyActive, setPartyActive] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [qrData, setQrData] = useState<string | null>(null)
  const socketRef = useRef<PartySocket | null>(null)

  const connectSocket = () => {
    if (socketRef.current) return
    const socket: PartySocket = io('ws://localhost:3000', { transports: ['websocket'] })
    socket.on('queue:updated', (q) => setQueue(q))
    socket.on('session:joined', (session) => setQueue(session.queue))
    socket.emit('session:join', { sessionId: '', name: 'Host' })
    socketRef.current = socket
  }

  const startParty = async () => {
    const result = await (window as any).api.startParty()
    setPartyActive(true)
    setSessionId(result.sessionId)
    if (result.qr) setQrData(result.qr)
    connectSocket()
  }

  const stopParty = async () => {
    await (window as any).api.stopParty()
    socketRef.current?.disconnect()
    socketRef.current = null
    setPartyActive(false)
    setSessionId(null)
    setQrData(null)
    setQueue({ items: [], nowPlaying: null, history: [] })
  }

  const removeItem = (id: string) => {
    socketRef.current?.emit('queue:remove', id)
  }

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect()
    }
  }, [])

  const nowPlaying = queue.nowPlaying ?? (currentSong ? { song: currentSong, isPlaying: false, positionMs: 0 } : null)

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

      {partyActive && qrData && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
              Scan to join on mobile
            </div>
            <img
              src={qrData}
              alt="Join QR code"
              style={{ width: 140, height: 140, borderRadius: 8, background: '#fff', padding: 6 }}
            />
          </div>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6, paddingTop: 4 }}>
            Open the Kara app on your phone<br />
            and scan this code, or enter<br />
            the host IP in Settings → Party Mode.
          </div>
        </div>
      )}

      {nowPlaying && (
        <div style={{ background: '#1a1a1a', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#e05', fontWeight: 700, marginBottom: 4 }}>NOW PLAYING</div>
          <div style={{ fontWeight: 600 }}>{nowPlaying.song.title}</div>
          <div style={{ color: '#888', fontSize: 13 }}>{nowPlaying.song.artist}</div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {queue.items.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', marginTop: 40 }}>
            {partyActive
              ? 'Queue is empty — guests can add songs from the mobile app.'
              : 'Start a party to enable the shared queue.'}
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
              <button
                onClick={() => removeItem(item.id)}
                style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
                title="Remove"
              >
                ✕
              </button>
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
