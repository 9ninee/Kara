import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useParty } from '../../hooks/useParty'
import type { Song } from '@kara/shared'

export default function QueueScreen() {
  const { session, connected, disconnect, addSong, removeSong, skipVote } = useParty()
  const queue = session?.queue

  const [libOpen, setLibOpen] = useState(false)
  const [libSongs, setLibSongs] = useState<Song[]>([])
  const [libLoading, setLibLoading] = useState(false)

  const openLibrary = useCallback(async () => {
    if (!session) return
    setLibOpen(true)
    setLibLoading(true)
    try {
      // Derive host base URL from the session's socket URL; fall back to a stored ref if available.
      // The socket connected to ws://host:3000, so HTTP is at http://host:3000.
      const resp = await fetch('http://localhost:3000/api/library')
      const songs: Song[] = await resp.json()
      setLibSongs(songs)
    } catch {
      Alert.alert('Error', 'Could not load host library.')
      setLibOpen(false)
    } finally {
      setLibLoading(false)
    }
  }, [session])

  const requestSong = useCallback(
    (song: Song) => {
      addSong(song)
      setLibOpen(false)
    },
    [addSong],
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Queue</Text>
        {connected ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.addBtn} onPress={openLibrary}>
              <Text style={styles.addBtnText}>+ Request</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.leaveBtn} onPress={disconnect}>
              <Text style={styles.leaveBtnText}>Leave</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.hint}>Join a party in Settings to see the queue</Text>
        )}
      </View>

      {queue?.nowPlaying && (
        <View style={styles.nowPlaying}>
          <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
          <Text style={styles.nowPlayingTitle}>{queue.nowPlaying.song.title}</Text>
          <Text style={styles.nowPlayingArtist}>{queue.nowPlaying.song.artist}</Text>
        </View>
      )}

      <FlatList
        data={queue?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={styles.queueItem}>
            <Text style={styles.queueIdx}>{index + 1}</Text>
            <View style={styles.queueInfo}>
              <Text style={styles.queueTitle}>{item.song.title}</Text>
              <Text style={styles.queueSub}>
                {item.song.artist} · by {item.requestedBy}
              </Text>
            </View>
            <TouchableOpacity onPress={() => skipVote(item.id)} style={styles.skipBtn}>
              <Text style={styles.skipBtnText}>
                Skip{item.skipVotes.length > 0 ? ` (${item.skipVotes.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeSong(item.id)} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {connected ? 'Queue is empty — tap Request to add a song' : 'Join a party in Settings'}
          </Text>
        }
      />

      {/* Library modal for song requests */}
      <Modal visible={libOpen} animationType="slide" onRequestClose={() => setLibOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request a Song</Text>
            <TouchableOpacity onPress={() => setLibOpen(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          {libLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#ee0055" />
          ) : (
            <FlatList
              data={libSongs}
              keyExtractor={(s) => s.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.libItem} onPress={() => requestSong(item)}>
                  <Text style={styles.libTitle}>{item.title}</Text>
                  <Text style={styles.libArtist}>{item.artist}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No songs in host library</Text>
              }
            />
          )}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  heading: { color: '#fff', fontSize: 20, fontWeight: '700' },
  hint: { color: '#555', fontSize: 13 },
  addBtn: {
    backgroundColor: '#ee0055',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  leaveBtn: { backgroundColor: '#333', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  leaveBtnText: { color: '#f66', fontSize: 13, fontWeight: '600' },
  nowPlaying: { margin: 16, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14 },
  nowPlayingLabel: { color: '#ee0055', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  nowPlayingTitle: { color: '#fff', fontWeight: '700', fontSize: 17 },
  nowPlayingArtist: { color: '#888', fontSize: 14, marginTop: 2 },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    gap: 10,
  },
  queueIdx: { color: '#555', width: 20, textAlign: 'right' },
  queueInfo: { flex: 1 },
  queueTitle: { color: '#fff', fontWeight: '600', fontSize: 15 },
  queueSub: { color: '#666', fontSize: 12, marginTop: 2 },
  skipBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  skipBtnText: { color: '#fa0', fontSize: 12 },
  removeBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  removeBtnText: { color: '#555', fontSize: 16 },
  emptyText: { color: '#555', padding: 32, textAlign: 'center', fontSize: 15 },
  modal: { flex: 1, backgroundColor: '#0a0a0a' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalClose: { color: '#ee0055', fontSize: 16, fontWeight: '600' },
  libItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  libTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  libArtist: { color: '#888', fontSize: 13, marginTop: 2 },
})
