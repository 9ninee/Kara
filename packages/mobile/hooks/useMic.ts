import { useState, useRef, useCallback } from 'react'
import { Audio } from 'expo-av'

export interface MicState {
  isActive: boolean
  volume: number
}

export interface MicControls {
  state: MicState
  start: () => Promise<void>
  stop: () => Promise<void>
  setVolume: (v: number) => void
}

export function useMic(): MicControls {
  const recordingRef = useRef<Audio.Recording | null>(null)
  const [state, setState] = useState<MicState>({ isActive: false, volume: 0.8 })

  const start = useCallback(async () => {
    await Audio.requestPermissionsAsync()
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    })
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    )
    recordingRef.current = recording
    setState((s) => ({ ...s, isActive: true }))
  }, [])

  const stop = useCallback(async () => {
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync()
      recordingRef.current = null
    }
    setState((s) => ({ ...s, isActive: false }))
  }, [])

  const setVolume = useCallback((v: number) => {
    setState((s) => ({ ...s, volume: v }))
  }, [])

  return { state, start, stop, setVolume }
}
