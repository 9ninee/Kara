import React, { useState } from 'react'
import { View, TouchableOpacity, Text, StyleSheet, Alert, Platform } from 'react-native'
import { Audio } from 'expo-av'

interface Props {
  compact?: boolean
}

export default function CastingButton({ compact = false }: Props) {
  const [airplayReady, setAirplayReady] = useState(false)

  const enableAirPlay = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        // On iOS, setting this allows the system AirPlay route picker to appear
        interruptionModeIOS: 1,
      })
      setAirplayReady(true)
      Alert.alert(
        'AirPlay',
        'Use the Control Center AirPlay button or the system route picker to select an AirPlay output device.',
      )
    } catch (err) {
      Alert.alert('Error', String(err))
    }
  }

  const openChromecast = () => {
    Alert.alert(
      'Chromecast',
      'Chromecast support requires a native build with react-native-google-cast. Use Expo EAS to create a development build with Chromecast enabled.',
    )
  }

  if (compact) {
    return (
      <View style={styles.row}>
        <TouchableOpacity style={styles.iconBtn} onPress={enableAirPlay}>
          <Text style={styles.iconBtnText}>AirPlay</Text>
        </TouchableOpacity>
        {Platform.OS === 'android' && (
          <TouchableOpacity style={styles.iconBtn} onPress={openChromecast}>
            <Text style={styles.iconBtnText}>Cast</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Cast to device</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.castBtn} onPress={enableAirPlay}>
          <Text style={styles.castBtnText}>AirPlay</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.castBtn, styles.castBtnSecondary]} onPress={openChromecast}>
          <Text style={[styles.castBtnText, { color: '#ccc' }]}>Chromecast</Text>
        </TouchableOpacity>
      </View>
      {airplayReady && (
        <Text style={styles.hint}>Audio session configured — open Control Center to select AirPlay output.</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111', borderRadius: 12, padding: 16, marginBottom: 16 },
  label: { color: '#888', fontSize: 12, marginBottom: 12, fontWeight: '600', textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 10 },
  castBtn: {
    flex: 1,
    backgroundColor: '#ee0055',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  castBtnSecondary: { backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#333' },
  castBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  iconBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#1a1a1a', borderRadius: 8 },
  iconBtnText: { color: '#aaa', fontSize: 12 },
  hint: { color: '#666', fontSize: 12, marginTop: 10, lineHeight: 17 },
})
