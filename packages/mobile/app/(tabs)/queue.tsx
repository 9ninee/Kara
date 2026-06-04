import React from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native'
import { useParty } from '../../hooks/useParty'

export default function QueueScreen() {
  const { session, connected, connect, disconnect } = useParty()
  const queue = session?.queue

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Queue</Text>
        {connected ? (
          <TouchableOpacity style={styles.leaveBtn} onPress={disconnect}>
            <Text style={styles.leaveBtnText}>Leave Party</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.hint}>Join a party to see the queue</Text>
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
            {item.skipVotes.length > 0 && (
              <Text style={styles.skipBadge}>{item.skipVotes.length} skip</Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {connected ? 'Queue is empty' : 'Join a party to see the queue'}
          </Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  heading: { color: '#fff', fontSize: 20, fontWeight: '700' },
  hint: { color: '#555', fontSize: 13 },
  leaveBtn: { backgroundColor: '#333', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  leaveBtnText: { color: '#f66', fontSize: 13, fontWeight: '600' },
  nowPlaying: { margin: 16, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14 },
  nowPlayingLabel: { color: '#ee0055', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  nowPlayingTitle: { color: '#fff', fontWeight: '700', fontSize: 17 },
  nowPlayingArtist: { color: '#888', fontSize: 14, marginTop: 2 },
  queueItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', gap: 12 },
  queueIdx: { color: '#555', width: 20, textAlign: 'right' },
  queueInfo: { flex: 1 },
  queueTitle: { color: '#fff', fontWeight: '600', fontSize: 15 },
  queueSub: { color: '#666', fontSize: 12, marginTop: 2 },
  skipBadge: { color: '#fa0', fontSize: 12 },
  emptyText: { color: '#555', padding: 32, textAlign: 'center', fontSize: 15 },
})
