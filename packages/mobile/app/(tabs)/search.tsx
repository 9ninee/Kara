import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { useLibrary } from '../../hooks/useLibrary'
import { useAppContext } from '../../context/AppContext'
import { useParty } from '../../context/PartyContext'
import type { HostSong } from '../../context/PartyContext'
import type { Song } from '@kara/shared'

export default function LibraryScreen() {
  const { songs, addSongs, removeSong } = useLibrary()
  const { playSong, playerState } = useAppContext()
  const { connected, fetchHostLibrary, addToQueue } = useParty()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'local' | 'party'>('local')
  const [hostSongs, setHostSongs] = useState<HostSong[]>([])
  const [urlMode, setUrlMode] = useState(false)
  const [songUrl, setSongUrl] = useState('')

  // Load the host's library whenever the party tab is opened
  useEffect(() => {
    if (tab !== 'party' || !connected) return
    fetchHostLibrary()
      .then(setHostSongs)
      .catch((e: unknown) => Alert.alert('Could not load host library', String(e)))
  }, [tab, connected, fetchHostLibrary])

  useEffect(() => {
    if (!connected) setTab('local')
  }, [connected])

  const activeSongs = tab === 'party' ? hostSongs : songs
  const filtered = query.trim()
    ? activeSongs.filter(
        (s) =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.artist.toLowerCase().includes(query.toLowerCase()),
      )
    : activeSongs

  const requestSong = (song: HostSong) => {
    addToQueue(song)
    Alert.alert('Added to queue', `"${song.title}" was added to the party queue.`)
  }

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

  const handleAddUrl = async () => {
    const url = songUrl.trim()
    if (!/^https?:\/\/.+/i.test(url)) {
      Alert.alert('Invalid link', 'Paste a direct link to an audio file (http:// or https://).')
      return
    }
    // derive a display name from the last path segment of the URL
    let name = 'Song from link'
    try {
      const last = decodeURIComponent(url.split('?')[0].split('/').filter(Boolean).pop() ?? '')
      if (last) name = last
    } catch { /* keep default name */ }
    const [added] = await addSongs([{ uri: url, name }])
    setSongUrl('')
    setUrlMode(false)
    Alert.alert('Added to library', `"${added.title}" was added. Tap it to play.`)
  }

  const renderSong = ({ item }: { item: Song }) => {
    const isActive = playerState.song?.id === item.id
    const isParty = tab === 'party'
    return (
      <TouchableOpacity
        style={[styles.songRow, isActive && styles.songRowActive]}
        onPress={() => (isParty ? requestSong(item as HostSong) : playSong(item))}
        onLongPress={() => { if (!isParty) removeSong(item.id) }}
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
        {isParty && (
          <View style={[styles.badge, { backgroundColor: '#2a0a14' }]}>
            <Text style={[styles.badgeText, { color: '#ee0055' }]}>+ QUEUE</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {connected && (
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'local' && styles.tabBtnActive]}
            onPress={() => setTab('local')}
          >
            <Text style={[styles.tabText, tab === 'local' && styles.tabTextActive]}>My Songs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'party' && styles.tabBtnActive]}
            onPress={() => setTab('party')}
          >
            <Text style={[styles.tabText, tab === 'party' && styles.tabTextActive]}>Party Library</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.toolbar}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={tab === 'party' ? 'Search host library…' : 'Search library…'}
          placeholderTextColor="#555"
          clearButtonMode="while-editing"
        />
        {tab === 'local' && (
          <>
            <TouchableOpacity style={styles.importBtn} onPress={handleImport}>
              <Text style={styles.importBtnText}>+ Import</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: '#1a1a2a' }]}
              onPress={() => setUrlMode((v) => !v)}
            >
              <Text style={[styles.importBtnText, { color: '#4af' }]}>+ URL</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {tab === 'local' && urlMode && (
        <View style={styles.urlRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={songUrl}
            onChangeText={setSongUrl}
            placeholder="https://example.com/song.mp3"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity style={styles.importBtn} onPress={handleAddUrl}>
            <Text style={styles.importBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        renderItem={renderSong}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{tab === 'party' ? 'Host library is empty' : 'No songs yet'}</Text>
            <Text style={styles.emptyHint}>
              {tab === 'party'
                ? 'Tap a song to add it to the party queue once the host imports music.'
                : 'Tap "+ Import" to add MP3 files from your device,\nor "+ URL" to add a song from a direct link.\nLong-press a song to remove it.'}
            </Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  tabBtn: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#ee0055' },
  tabText: { color: '#888', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },
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
  urlRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
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
