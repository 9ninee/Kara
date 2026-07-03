import { Tabs } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AppProvider } from '../context/AppContext'
import { PartyProvider } from '../context/PartyContext'

export default function RootLayout() {
  return (
    <AppProvider>
      <PartyProvider>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          tabBarStyle: { backgroundColor: '#111', borderTopColor: '#222' },
          tabBarActiveTintColor: '#ee0055',
          tabBarInactiveTintColor: '#666',
          headerStyle: { backgroundColor: '#111' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Tabs.Screen name="(tabs)/index" options={{ title: 'Player', tabBarLabel: 'Player' }} />
        <Tabs.Screen name="(tabs)/search" options={{ title: 'Library', tabBarLabel: 'Library' }} />
        <Tabs.Screen name="(tabs)/queue" options={{ title: 'Queue', tabBarLabel: 'Queue' }} />
        <Tabs.Screen name="(tabs)/settings" options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
      </Tabs>
      </PartyProvider>
    </AppProvider>
  )
}
