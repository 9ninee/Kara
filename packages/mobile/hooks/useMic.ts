import { useState, useCallback } from 'react'
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio'

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
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [state, setState] = useState<MicState>({ isActive: false, volume: 0.8 })

  const start = useCallback(async () => {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync()
    if (!granted) return
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        // keep background playback alive — omitting this can reset the
        // flag AppContext set and stop the backing track on screen lock
        shouldPlayInBackground: true,
      })
      await recorder.prepareToRecordAsync()
      recorder.record()
      setState((s) => ({ ...s, isActive: true }))
    } catch (err: unknown) {
      console.warn('[useMic] start failed', err)
    }
  }, [recorder])

  const stop = useCallback(async () => {
    try {
      await recorder.stop()
    } catch (err: unknown) {
      console.warn('[useMic] stop failed', err)
    }
    setState((s) => ({ ...s, isActive: false }))
  }, [recorder])

  const setVolume = useCallback((v: number) => {
    setState((s) => ({ ...s, volume: v }))
  }, [])

  return { state, start, stop, setVolume }
}
