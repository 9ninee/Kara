import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useSocket } from './hooks/useSocket'
import { usePlayer } from './hooks/usePlayer'
import { useMic } from './hooks/useMic'
import Player from './pages/Player'
import Library from './pages/Library'
import Queue from './pages/Queue'
import Settings from './pages/Settings'

type Page = 'player' | 'library' | 'queue' | 'settings'

export default function App() {
  const [page, setPage] = useState<Page>('player')
  const [singerName, setSingerName] = useState(() => localStorage.getItem('singerName') ?? '')
  const [showNamePrompt, setShowNamePrompt] = useState(!localStorage.getItem('singerName'))
  const [nameInput, setNameInput] = useState('')
  const [connectedCount, setConnectedCount] = useState(1)

  const { state, connected, emit } = useSocket()
  const { audioRef, cdgPlayer, lrcLines, loading, loadSong } = usePlayer()
  const { state: mic, start: startMic, stop: stopMic, setMicGain } = useMic()

  const prevSongId = useRef<string | null>(null)

  // Load song when nowPlaying changes
  useEffect(() => {
    const np = state.queue.nowPlaying
    const songId = np?.item.song.id ?? null
    if (songId && songId !== prevSongId.current) {
      prevSongId.current = songId
      loadSong(songId, np!.item.song.format)
    }
  }, [state.queue.nowPlaying, loadSong])

  // Track connected count from server
  useEffect(() => {
    // Approximate via queue voters; server could emit this too
    const voters = new Set<string>()
    state.queue.items.forEach(i => i.skipVotes.forEach(v => voters.add(v)))
    if (state.queue.nowPlaying) state.queue.nowPlaying.item.skipVotes.forEach(v => voters.add(v))
    if (singerName) voters.add(singerName)
    setConnectedCount(Math.max(1, voters.size))
  }, [state.queue, singerName])

  const saveName = () => {
    const n = nameInput.trim()
    if (!n) return
    setSingerName(n)
    localStorage.setItem('singerName', n)
    setShowNamePrompt(false)
  }

  const handleAdd = useCallback((songId: string, singer: string) => {
    emit('queue:add', { songId, singerName: singer })
    setPage('queue')
  }, [emit])

  const handleSkipVote = useCallback((itemId: string) => {
    emit('queue:skip-vote', { itemId, voterId: singerName })
  }, [emit, singerName])

  const handleForceSkip = useCallback(() => {
    emit('queue:skip-force')
  }, [emit])

  const handleRemove = useCallback((itemId: string) => {
    emit('queue:remove', { itemId })
  }, [emit])

  const handleSeek = useCallback((ms: number) => {
    emit('playback:seek', { positionMs: ms })
  }, [emit])

  const handlePlayPause = useCallback(() => {
    emit(state.playback.isPlaying ? 'playback:pause' : 'playback:play')
  }, [emit, state.playback.isPlaying])

  const handleEnded = useCallback(() => {
    emit('playback:ended')
  }, [emit])

  if (showNamePrompt) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a' }}>
        <div style={{ textAlign: 'center', width: 320 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎤</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Welcome to Kara</div>
          <div style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>Enter your name to join the session</div>
          <input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveName()}
            placeholder="Your name…"
            autoFocus
            style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 15, boxSizing: 'border-box', marginBottom: 12 }}
          />
          <button onClick={saveName} style={{ width: '100%', background: '#e05', border: 'none', color: '#fff', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 15, fontWeight: 700 }}>
            Join
          </button>
        </div>
      </div>
    )
  }

  const np = state.queue.nowPlaying

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: 44, background: '#0d0d0d', borderBottom: '1px solid #1a1a1a', flexShrink: 0, gap: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#e05', letterSpacing: -0.5, marginRight: 8 }}>KARA</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: connected ? '#4c8' : '#c44', marginRight: 8 }}>
          {connected ? '● Live' : '○ Connecting'}
        </div>
        <div style={{ fontSize: 12, color: '#555', background: '#111', border: '1px solid #1a1a1a', borderRadius: 20, padding: '3px 10px', cursor: 'pointer' }}
          onClick={() => { localStorage.removeItem('singerName'); setSingerName(''); setShowNamePrompt(true); setNameInput('') }}>
          👤 {singerName}
        </div>
        {mic.active && <div style={{ width: 8, height: 8, borderRadius: 4, background: '#e05', animation: 'pulse 1s infinite' }} title="Mic active" />}
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {page === 'player' && (
          <Player
            songId={state.playback.songId}
            format={np?.item.song.format ?? ''}
            positionMs={state.playback.positionMs}
            isPlaying={state.playback.isPlaying}
            cdgPlayer={cdgPlayer}
            lrcLines={lrcLines}
            loading={loading}
            onEnded={handleEnded}
            onSeek={handleSeek}
            onPlayPause={handlePlayPause}
            audioRef={audioRef}
            singerName={np?.item.singerName ?? ''}
          />
        )}
        {page === 'library' && (
          <Library onAdd={handleAdd} singerName={singerName} />
        )}
        {page === 'queue' && (
          <Queue
            items={state.queue.items}
            nowPlaying={state.queue.nowPlaying}
            history={state.queue.history}
            singerName={singerName}
            onSkipVote={handleSkipVote}
            onForceSkip={handleForceSkip}
            onRemove={handleRemove}
            connectedCount={connectedCount}
          />
        )}
        {page === 'settings' && (
          <Settings
            mic={mic}
            onStartMic={startMic}
            onStopMic={stopMic}
            onSetMicGain={setMicGain}
          />
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ display: 'flex', borderTop: '1px solid #1a1a1a', flexShrink: 0, background: '#0d0d0d' }}>
        {([
          { id: 'player', icon: '▶', label: 'Player' },
          { id: 'library', icon: '🎵', label: 'Library' },
          { id: 'queue', icon: '☰', label: 'Queue' },
          { id: 'settings', icon: '⚙', label: 'Settings' },
        ] as { id: Page; icon: string; label: string }[]).map(tab => (
          <button key={tab.id} onClick={() => setPage(tab.id)}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              color: page === tab.id ? '#e05' : '#555',
              padding: '10px 0 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              borderTop: page === tab.id ? '2px solid #e05' : '2px solid transparent',
            }}>
            <span style={{ fontSize: 18 }}>{tab.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Queue badge overlay on Queue tab */}
      {state.queue.items.length > 0 && (
        <style>{`
          button[data-tab="queue"]::after { content: '${state.queue.items.length}'; }
        `}</style>
      )}

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        input[type=range] { cursor: pointer; }
        select option { background: #111; }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
      `}</style>

      <audio ref={audioRef as React.RefObject<HTMLAudioElement>} style={{ display: 'none' }} />
    </div>
  )
}
