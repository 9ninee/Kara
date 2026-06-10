import express from 'express'
import { createServer } from 'http'
import { join } from 'path'
import cors from 'cors'
import { networkInterfaces } from 'os'
import Bonjour from 'bonjour-service'
import QRCode from 'qrcode'
import { createSocketServer } from './api/socket.js'
import routes from './api/routes.js'

const PORT = parseInt(process.env.PORT ?? '3000')
const WEB_DIST = join(process.cwd(), 'packages', 'web', 'dist')

const app = express()
const httpServer = createServer(app)

app.use(cors())
app.use(express.json())
app.use('/api', routes)

// Serve the built web client
app.use(express.static(WEB_DIST))
app.get('*', (_req, res) => res.sendFile(join(WEB_DIST, 'index.html')))

// Start Socket.IO
createSocketServer(httpServer)

function getLocalIP(): string {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (!iface.internal && iface.family === 'IPv4') return iface.address
    }
  }
  return '127.0.0.1'
}

httpServer.listen(PORT, '0.0.0.0', async () => {
  const ip = getLocalIP()
  const url = `http://${ip}:${PORT}`

  console.log(`\n🎤  Kara Server v2`)
  console.log(`    Local:   http://localhost:${PORT}`)
  console.log(`    Network: ${url}`)

  const qr = await QRCode.toString(url, { type: 'terminal', small: true })
  console.log('\n    Scan to join on your phone:\n')
  console.log(qr)

  // mDNS broadcast so phones auto-discover
  const bonjour = new Bonjour()
  bonjour.publish({ name: 'Kara Karaoke', type: 'kara', port: PORT, txt: { version: '2' } })
})
