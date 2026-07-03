import React, { useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Switch } from 'react-native'
import Slider from '@react-native-community/slider'
import { useParty } from '../../context/PartyContext'
import { useMic } from '../../hooks/useMic'
import { useAppContext } from '../../context/AppContext'
import { CastingButton } from '../../components/CastingButton'
import { QRJoinScanner } from '../../components/QRJoinScanner'

export default function SettingsScreen() {
  const { connect, connected, session, disconnect } = useParty()
  const mic = useMic()
  const { setMicVolume, playerState } = useAppContext()
  const [hostIp, setHostIp] = useState('')
  const [name, setName] = useState('')
  const [scanning, setScanning] = useState(false)

  const joinParty = async () => {
    if (!hostIp.trim() || !name.trim()) {
      Alert.alert('Missing info', 'Enter your name and the host IP address.')
      return
    }
    try {
      await connect(`http://${hostIp.trim()}:3000`, name.trim())
    } catch (e: unknown) {
      Alert.alert('Connection failed', String(e))
    }
  }

  const joinFromQR = async (host: string, port: string) => {
    setScanning(false)
    try {
      await connect(`http://${host}:${port}`, name.trim() || 'Guest')
    } catch (e: unknown) {
      Alert.alert('Connection failed', String(e))
    }
  }

  const toggleMic = async () => {
    if (mic.state.isActive) {
      await mic.stop()
    } else {
      await mic.start()
    }
  }

  return (
    <View style={styles.container}>

      {/* Microphone */}
      <Text style={styles.sectionTitle}>Microphone</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Enable microphone</Text>
          <Switch
            value={mic.state.isActive}
            onValueChange={toggleMic}
            thumbColor="#fff"
            trackColor={{ false: '#333', true: '#ee0055' }}
          />
        </View>
        {mic.state.isActive && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.fieldLabel}>Mic volume ({Math.round(playerState.micVolume * 100)}%)</Text>
            <Slider
              minimumValue={0}
              maximumValue={1}
              value={playerState.micVolume}
              onValueChange={(v) => { mic.setVolume(v); setMicVolume(v) }}
              minimumTrackTintColor="#44aaff"
              maximumTrackTintColor="#333"
            />
            <Text style={styles.hint}>
              Microphone is active. On iOS, mic audio passes through the system when AirPlay or speakers are selected as the output route.
            </Text>
          </View>
        )}
      </View>

      {/* Casting */}
      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Casting</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Cast to TV or speakers</Text>
        <CastingButton style={{ marginTop: 10 }} />
        <Text style={styles.hint}>
          AirPlay: tap to open the system audio route picker.{'\n'}
          Chromecast: tap the Cast icon to connect to a nearby device.
        </Text>
      </View>

      {/* Party mode */}
      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Party Mode</Text>
      {connected ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Connected</Text>
          <Text style={styles.cardValue}>Session {session?.id?.slice(0, 8)}</Text>
          <Text style={styles.cardParticipants}>
            {session?.participants.length ?? 0} participant(s)
          </Text>
          <TouchableOpacity style={[styles.joinBtn, { backgroundColor: '#333', marginTop: 12 }]} onPress={disconnect}>
            <Text style={[styles.joinBtnText, { color: '#f66' }]}>Leave Party</Text>
          </TouchableOpacity>
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
          <TouchableOpacity
            style={[styles.joinBtn, { backgroundColor: '#1a1a2a', marginTop: 8 }]}
            onPress={() => setScanning(true)}
          >
            <Text style={[styles.joinBtnText, { color: '#4af' }]}>Scan QR Code</Text>
          </TouchableOpacity>
          {scanning && (
            <QRJoinScanner
              onJoin={joinFromQR}
              onCancel={() => setScanning(false)}
            />
          )}
        </View>
      )}

      {/* About */}
      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>About</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Kara v0.1.0</Text>
        <Text style={styles.cardValue}>Open-source karaoke for macOS &amp; iOS</Text>
      </View>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 20 },
  sectionTitle: { color: '#ee0055', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10 },
  card: { backgroundColor: '#111', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  cardValue: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardParticipants: { color: '#aaa', fontSize: 13, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: '#fff', fontSize: 15 },
  fieldLabel: { color: '#888', fontSize: 12, marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 2,
  },
  joinBtn: { backgroundColor: '#ee0055', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 14 },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint: { color: '#555', fontSize: 12, marginTop: 8, lineHeight: 17 },
})
