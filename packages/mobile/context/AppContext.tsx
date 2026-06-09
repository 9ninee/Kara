import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { Audio, AVPlaybackStatus } from 'expo-av'
import { parseLRC } from '@kara/shared'
import type { Song, LyricsLine } from '@kara/shared'
import { useMic } from '../hooks/useMic'
import type { MicControls } from '../hooks/useMic'

export interface PlayerState {
  song: Song | null
  isPlaying: boolean
  currentTimeMs: number
  durationMs: number
  musicVolume: number
  micVolume: number
  lrcLines: LyricsLine[]
  loading: boolean
}

export interface AppContextValue {
  playerState: PlayerState
  playSong: (song: Song) => Promise<void>
  play: () => Promise<void>
  pause: () => Promise<void>
  seek: (ms: number) => Promise<void>
  setMusicVolume: (v: number) => void
  setMicVolume: (v: number) => void
  mic: MicControls
}

const defaultState: PlayerState = {
  song: null,
  isPlaying: false,
  currentTimeMs: 0,
  durationMs: 0,
  musicVolume: 1,
  micVolume: 0.8,
  lrcLines: [],
  loading: false,
}

const AppContext = createContext<AppContextValue>({
  playerState: defaultState,
  playSong: async () => {},
  play: async () => {},
  pause: async () => {},
  seek: async () => {},
  setMusicVolume: () => {},
  setMicVolume: () => {},
  mic: { state: { isActive: false, volume: 0.8 }, start: async () => {}, stop: async () => {}, setVolume: () => {} },
})

export function AppProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const soundRef = useRef<Audio.Sound | null>(null)
  const musicVolumeRef = useRef(1)
  const [state, setState] = useState<PlayerState>(defaultState)
  const mic = useMic()

  const onStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return
    setState((s) => ({
      ...s,
      isPlaying: status.isPlaying,
      currentTimeMs: status.positionMillis,
      durationMs: status.durationMillis ?? 0,
    }))
  }, [])

  const playSong = useCallback(
    async (song: Song) => {
      setState((s) => ({ ...s, loading: true, song }))
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        })
        if (soundRef.current) await soundRef.current.unloadAsync()

        const { sound } = await Audio.Sound.createAsync(
          { uri: song.audioPath },
          { shouldPlay: false, volume: musicVolumeRef.current },
          onStatus,
        )
        soundRef.current = sound

        let lrcLines: LyricsLine[] = []
        if (song.lrcPath) {
          const resp = await fetch(song.lrcPath)
          const text = await resp.text()
          lrcLines = parseLRC(text)
        }

        setState((s) => ({
          ...s,
          song,
          isPlaying: false,
          currentTimeMs: 0,
          lrcLines,
          loading: false,
        }))
      } catch {
        setState((s) => ({ ...s, loading: false }))
      }
    },
    [onStatus],
  )

  const play = useCallback(async () => {
    await soundRef.current?.playAsync()
  }, [])

  const pause = useCallback(async () => {
    await soundRef.current?.pauseAsync()
  }, [])

  const seek = useCallback(async (ms: number) => {
    await soundRef.current?.setPositionAsync(ms)
  }, [])

  const setMusicVolume = useCallback((v: number) => {
    musicVolumeRef.current = v
    soundRef.current?.setVolumeAsync(v)
    setState((s) => ({ ...s, musicVolume: v }))
  }, [])

  const setMicVolume = useCallback((v: number) => {
    setState((s) => ({ ...s, micVolume: v }))
  }, [])

  return (
    <AppContext.Provider value={{ playerState: state, playSong, play, pause, seek, setMusicVolume, setMicVolume, mic }}>
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = (): AppContextValue => useContext(AppContext)
