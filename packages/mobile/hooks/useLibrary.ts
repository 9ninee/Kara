import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { randomUUID } from 'expo-crypto'
import type { Song } from '@kara/shared'

const STORAGE_KEY = '@kara/library/v1'

export interface LibraryControls {
  songs: Song[]
  addSongs: (entries: Array<{ uri: string; name: string }>) => Promise<Song[]>
  removeSong: (id: string) => Promise<void>
  refreshLibrary: () => Promise<void>
}

export function useLibrary(): LibraryControls {
  const [songs, setSongs] = useState<Song[]>([])

  const refreshLibrary = useCallback(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    setSongs(raw ? (JSON.parse(raw) as Song[]) : [])
  }, [])

  useEffect(() => {
    refreshLibrary()
  }, [refreshLibrary])

  const persist = useCallback(async (next: Song[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setSongs(next)
  }, [])

  const addSongs = useCallback(
    async (entries: Array<{ uri: string; name: string }>): Promise<Song[]> => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      const existing: Song[] = raw ? JSON.parse(raw) : []

      const added: Song[] = entries.map(({ uri, name }) => {
        const base = name.replace(/\.[^.]+$/, '')
        const dashIdx = base.indexOf(' - ')
        const title = dashIdx >= 0 ? base.slice(dashIdx + 3).trim() : base
        const artist = dashIdx >= 0 ? base.slice(0, dashIdx).trim() : 'Unknown'
        return {
          id: randomUUID(),
          title,
          artist,
          duration: 0,
          source: 'local' as const,
          audioPath: uri,
          addedAt: Date.now(),
          playCount: 0,
        }
      })

      const next = [...existing, ...added]
      await persist(next)
      return added
    },
    [persist],
  )

  const removeSong = useCallback(
    async (id: string) => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      const existing: Song[] = raw ? JSON.parse(raw) : []
      await persist(existing.filter((s) => s.id !== id))
    },
    [persist],
  )

  return { songs, addSongs, removeSong, refreshLibrary }
}
