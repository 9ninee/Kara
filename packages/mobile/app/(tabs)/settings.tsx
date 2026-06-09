import React, { useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native'
import Slider from '@react-native-community/slider'
import { useParty } from '../../hooks/useParty'
import { useAppContext } from '../../context/AppContext'
import CastingButton from '../../components/CastingButton'

export default function SettingsScreen() {
  const { connect, connected, session } = useParty()
  const { mic } = useAppContext()
  const [hostIp, setHostIp] = useState('')
  const [name, setName] = useState('')

  const joinParty = async () => {
    if (!hostIp.trim() || !name.trim()) {
      Alert.alert('Missing info', 'Enter your name and host IP.')
      return
    }
    try {
      await connect(`ws://${hostIp}:3000`, name)
    } catch (e) {
      Alert.alert('Connection failed', String(e))
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.sectionTitle}>Microphone</Text>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.cardLabel}>Mic passthrough</Text>
          <TouchableOpacity
            onPress={mic.state.isActive ? mic.stop : mic.start}
            style={[styles.joinBtn, { paddingVertical: 8, paddingHorizontal: 16, marginTop: 0 }]}
          >
            <Text style={styles.joinBtnText}>{mic.state.isActive ? 'Stop Mic' : 'Start Mic'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.fieldLabel}>Mic volume</Text>
        <Slider
          style={{ width: '100%', height: 36 }}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          value={mic.state.volume}
          onValueChange={mic.setVolume}
          minimumTrackTintColor="#ee0055"
          maximumTrackTintColor="#333"
          thumbTintColor="#ee0055"
        />
      </View>

      <Text style={styles.sectionTitle}>Party Mode</Text>

      {connected ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Connected</Text>
          <Text style={styles.cardValue}>Session {session?.id?.slice(0, 8)}</Text>
          <Text style={styles.cardParticipants}>
            {session?.participants.length ?? 0} participant(s)
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Your name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Alex"
            placeholderTextColor="#555"
          />
          <Text style={styles.fieldLabel}>Host IP address</Text>
          <TextInput
            style={styles.input}
            value={hostIp}
            onChangeText={setHostIp}
            placeholder="192.168.1.x"
            placeholderTextColor="#555"
            keyboardType="decimal-pad"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.joinBtn} onPress={joinParty}>
            <Text style={styles.joinBtnText}>Join Party</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Casting</Text>
      <CastingButton />

      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>About</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Kara v0.1.0</Text>
        <Text style={styles.cardValue}>Open-source karaoke for macOS &amp; iOS</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 20 },
  sectionTitle: { color: '#ee0055', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10 },
  card: { backgroundColor: '#111', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  cardValue: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardParticipants: { color: '#aaa', fontSize: 13, marginTop: 4 },
  fieldLabel: { color: '#888', fontSize: 12, marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  joinBtn: { backgroundColor: '#ee0055', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 14 },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
