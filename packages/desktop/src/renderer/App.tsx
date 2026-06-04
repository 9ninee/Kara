import React, { useState } from 'react'
import Player from './pages/Player'
import Library from './pages/Library'
import Queue from './pages/Queue'
import Settings from './pages/Settings'

type Page = 'player' | 'library' | 'queue' | 'settings'

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: 'player', label: 'Player' },
  { id: 'library', label: 'Library' },
  { id: 'queue', label: 'Queue' },
  { id: 'settings', label: 'Settings' },
]

export default function App(): React.ReactElement {
  const [page, setPage] = useState<Page>('player')

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <nav
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 16px',
          background: '#111',
          borderBottom: '1px solid #222',
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      >
        <span style={{ fontWeight: 700, fontSize: 18, marginRight: 16, color: '#e05' }}>Kara</span>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            style={{
              background: page === item.id ? '#e05' : 'transparent',
              border: 'none',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: page === item.id ? 700 : 400,
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {page === 'player' && <Player />}
        {page === 'library' && <Library />}
        {page === 'queue' && <Queue />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  )
}
