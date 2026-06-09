import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import Slider from '@react-native-community/slider'
import { useAppContext } from '../../context/AppContext'
import LyricsDisplay from '../../components/LyricsDisplay'

export default function PlayerScreen() {
  const { playerState, play, pause, seek, setMusicVolume, setMicVolume } = useAppContext()
  const { isPlaying, currentTimeMs, durationMs, musicVolume, micVolume, lrcLines, song, loading } = playerState

  return (
    <View style={styles.container}>
      <View style={styles.lyricsArea}>
        {loading ? (
          <ActivityIndicator size="large" color="#ee0055" />
        ) : lrcLines.length > 0 ? (
          <LyricsDisplay lines={lrcLines} currentTimeMs={currentTimeMs} />
        ) : song ? (
          <View style={styles.centeredInfo}>
            <Text style={styles.songTitle}>{song.title}</Text>
            <Text style={styles.songArtist}>{song.artist}</Text>
          </View>
        ) : (
          <Text style={styles.emptyHint}>Open Library to pick a song</Text>
        )}
      </View>

      <View style={styles.controls}>
        {song && (
          <Text style={styles.nowPlaying} numberOfLines={1}>
            {song.title} · {song.artist}
          </Text>
        )}

        <Slider
          style={styles.progress}
          minimumValue={0}
          maximumValue={durationMs || 1}
          value={currentTimeMs}
          onSlidingComplete={seek}
          minimumTrackTintColor="#ee0055"
          maximumTrackTintColor="#333"
          thumbTintColor="#ee0055"
        />
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>{formatMs(currentTimeMs)}</Text>
          <Text style={styles.timeLabel}>{formatMs(durationMs)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.playBtn, !song && styles.disabled]}
          onPress={isPlaying ? pause : play}
          disabled={!song}
        >
          <Text style={styles.playBtnText}>{isPlaying ? '⏸  Pause' : '▶  Play'}</Text>
        </TouchableOpacity>

        <View style={styles.volumeRow}>
          <Text style={styles.volLabel}>Music</Text>
          <Slider
            style={styles.volSlider}
            minimumValue={0}
            maximumValue={1}
            value={musicVolume}
            onValueChange={setMusicVolume}
            minimumTrackTintColor="#ee0055"
            maximumTrackTintColor="#333"
          />
          <Text style={styles.volLabel}>Mic</Text>
          <Slider
            style={styles.volSlider}
            minimumValue={0}
            maximumValue={1}
            value={micVolume}
            onValueChange={setMicVolume}
            minimumTrackTintColor="#44aaff"
            maximumTrackTintColor="#333"
          />
        </View>
      </View>
    </View>
  )
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  lyricsArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centeredInfo: { alignItems: 'center', padding: 24 },
  songTitle: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center' },
  songArtist: { fontSize: 18, color: '#888', marginTop: 8, textAlign: 'center' },
  emptyHint: { color: '#555', fontSize: 16 },
  controls: { padding: 16, backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#222' },
  nowPlaying: { color: '#aaa', fontSize: 13, marginBottom: 4, textAlign: 'center' },
  progress: { width: '100%', height: 40 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
  timeLabel: { color: '#666', fontSize: 12 },
  playBtn: {
    backgroundColor: '#ee0055',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginVertical: 12,
  },
  disabled: { opacity: 0.4 },
  playBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  volLabel: { color: '#888', fontSize: 12, width: 36 },
  volSlider: { flex: 1, height: 36 },
})
