import express from 'express'
import { createServer } from 'http'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import cors from 'cors'
import { networkInterfaces } from 'os'
import Bonjour from 'bonjour-service'
import QRCode from 'qrcode'
import { createSocketServer } from './api/socket.js'
import routes, { mediaRouter } from './api/routes.js'
import { scanFolder, watchFolder } from './library/scanner.js'

const PORT = parseInt(process.env.PORT ?? '3000')
// Resolve relative to this file so it works regardless of cwd
// (src/ and dist/ are both one level below packages/server)
const HERE = dirname(fileURLToPath(import.meta.url))
const WEB_DIST = join(HERE, '..', '..', 'web', 'dist')

const app = express()
const httpServer = createServer(app)

app.use(cors())
app.use(express.json())
app.use('/api', routes)
app.use('/media', mediaRouter)

// Serve the built web client
app.use(express.static(WEB_DIST))
app.get('*', (_req, res) => {
  const index = join(WEB_DIST, 'index.html')
  if (!existsSync(index)) {
    return res.status(503).type('text/plain').send(
      'Web client not built yet.\nRun: pnpm --filter @kara/web build\nThen restart the server.'
    )
  }
  res.sendFile(index)
})

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

  // Auto-scan + watch a music folder if configured
  const musicDir = process.env.KARA_MUSIC_DIR
  if (musicDir && existsSync(musicDir)) {
    const count = await scanFolder(musicDir)
    console.log(`    Music library: ${musicDir} (${count} new songs indexed)`)
    watchFolder(musicDir)
  }

  // mDNS broadcast so phones auto-discover
  try {
    const bonjour = new Bonjour()
    bonjour.publish({ name: 'Kara Karaoke', type: 'kara', port: PORT, txt: { version: '2' } })
  } catch (e) {
    console.warn('    mDNS broadcast unavailable:', e instanceof Error ? e.message : e)
  }
})
