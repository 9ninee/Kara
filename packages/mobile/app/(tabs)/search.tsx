import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native'

interface YTResult {
  id: string
  title: string
  uploader: string
  duration: number
  thumbnail: string
  url: string
}

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<YTResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      // When connected to a party host, delegate to host's search endpoint;
      // otherwise stub results for now (YouTube integration is Phase 6)
      setResults([])
      setError('YouTube search requires a connected desktop host or yt-dlp on the device.')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search karaoke songs..."
          placeholderTextColor="#555"
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <TouchableOpacity style={styles.btn} onPress={search}>
          <Text style={styles.btnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color="#ee0055" style={{ marginTop: 24 }} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      <FlatList
        data={results}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <View style={styles.resultItem}>
            {item.thumbnail ? (
              <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, { backgroundColor: '#222' }]} />
            )}
            <View style={styles.resultInfo}>
              <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.resultSub}>{item.uploader}</Text>
            </View>
            <TouchableOpacity style={styles.addBtn}>
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>Search for a karaoke song above</Text>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  searchBar: { flexDirection: 'row', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  btn: { backgroundColor: '#ee0055', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  errorText: { color: '#f88', padding: 16, fontSize: 13, textAlign: 'center' },
  emptyText: { color: '#555', padding: 32, textAlign: 'center', fontSize: 15 },
  resultItem: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', alignItems: 'center', gap: 10 },
  thumb: { width: 72, height: 54, borderRadius: 6 },
  resultInfo: { flex: 1 },
  resultTitle: { color: '#fff', fontWeight: '600', fontSize: 14 },
  resultSub: { color: '#666', fontSize: 12, marginTop: 2 },
  addBtn: { backgroundColor: '#ee0055', borderRadius: 20, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },
})
