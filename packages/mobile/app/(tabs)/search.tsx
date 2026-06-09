import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { useLibrary } from '../../hooks/useLibrary'
import { useAppContext } from '../../context/AppContext'
import type { Song } from '@kara/shared'

export default function LibraryScreen() {
  const { songs, addSongs, removeSong } = useLibrary()
  const { playSong, playerState } = useAppContext()
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? songs.filter(
        (s) =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.artist.toLowerCase().includes(query.toLowerCase()),
      )
    : songs

  const handleImport = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/mpeg', 'audio/mp4', 'audio/*'],
      multiple: true,
      copyToCacheDirectory: true,
    })
    if (!result.canceled && result.assets.length > 0) {
      await addSongs(result.assets.map((a) => ({ uri: a.uri, name: a.name })))
    }
  }

  const renderSong = ({ item }: { item: Song }) => {
    const isActive = playerState.song?.id === item.id
    return (
      <TouchableOpacity
        style={[styles.songRow, isActive && styles.songRowActive]}
        onPress={() => playSong(item)}
        onLongPress={() => removeSong(item.id)}
      >
        <View style={styles.songInfo}>
          <Text style={[styles.songTitle, isActive && styles.songTitleActive]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.songArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        {item.lrcPath && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>LRC</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search library…"
          placeholderTextColor="#555"
          clearButtonMode="while-editing"
        />
        <TouchableOpacity style={styles.importBtn} onPress={handleImport}>
          <Text style={styles.importBtnText}>+ Import</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        renderItem={renderSong}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No songs yet</Text>
            <Text style={styles.emptyHint}>
              Tap "+ Import" to add MP3 files from your device.{'\n'}
              Long-press a song to remove it.
            </Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  toolbar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  importBtn: {
    backgroundColor: '#ee0055',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  importBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  songRowActive: {
    backgroundColor: '#1a0a14',
    borderLeftColor: '#ee0055',
  },
  songInfo: { flex: 1 },
  songTitle: { color: '#fff', fontWeight: '600', fontSize: 16 },
  songTitleActive: { color: '#ee0055' },
  songArtist: { color: '#888', fontSize: 13, marginTop: 2 },
  badge: {
    backgroundColor: '#0a1a2a',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: { color: '#4af', fontSize: 10, fontWeight: '700' },
  empty: { padding: 40, alignItems: 'center' },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  emptyHint: { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 22 },
})
