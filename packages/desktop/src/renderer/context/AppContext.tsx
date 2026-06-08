import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Song } from '@kara/shared'

interface AppContextValue {
  currentSong: Song | null
  /** Load a song into the player and switch to the player page */
  playSong: (song: Song) => void
  /** Page navigation request — App.tsx consumes this and resets to null */
  requestedPage: string | null
  clearRequestedPage: () => void
}

const AppContext = createContext<AppContextValue>({
  currentSong: null,
  playSong: () => {},
  requestedPage: null,
  clearRequestedPage: () => {},
})

export function AppProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [requestedPage, setRequestedPage] = useState<string | null>(null)

  const playSong = useCallback((song: Song) => {
    setCurrentSong(song)
    setRequestedPage('player')
  }, [])

  const clearRequestedPage = useCallback(() => setRequestedPage(null), [])

  return (
    <AppContext.Provider value={{ currentSong, playSong, requestedPage, clearRequestedPage }}>
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = (): AppContextValue => useContext(AppContext)
