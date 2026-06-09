import { Bonjour } from 'bonjour-service'
import QRCode from 'qrcode'
import { networkInterfaces } from 'os'

let bonjour: Bonjour | null = null
let publishedService: { stop: () => void } | null = null

function getLocalIP(): string {
  const nets = networkInterfaces()
  for (const interfaces of Object.values(nets)) {
    if (!interfaces) continue
    for (const iface of interfaces) {
      if (!iface.internal && iface.family === 'IPv4') return iface.address
    }
  }
  return '127.0.0.1'
}

export async function startDiscovery(sessionId: string, port: number): Promise<string> {
  bonjour = new Bonjour()
  publishedService = bonjour.publish({
    name: `Kara-${sessionId.slice(0, 8)}`,
    type: 'kara',
    port,
    txt: { sessionId, version: '1' },
  })

  const ip = getLocalIP()
  const url = `kara://join?host=${ip}&port=${port}&session=${sessionId}`
  const qr = await QRCode.toDataURL(url)
  return qr
}

export async function stopDiscovery(): Promise<void> {
  if (publishedService) {
    publishedService.stop()
    publishedService = null
  }
  if (bonjour) {
    bonjour.destroy()
    bonjour = null
  }
}
