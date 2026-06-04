import { Tabs } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  return (
    <>
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
        <Tabs.Screen name="(tabs)/search" options={{ title: 'Search', tabBarLabel: 'Search' }} />
        <Tabs.Screen name="(tabs)/queue" options={{ title: 'Queue', tabBarLabel: 'Queue' }} />
        <Tabs.Screen name="(tabs)/settings" options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
      </Tabs>
    </>
  )
}
