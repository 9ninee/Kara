import { createServer, IncomingMessage, ServerResponse } from 'http'
import { createReadStream, statSync } from 'fs'
import { extname } from 'path'
import { networkInterfaces } from 'os'
import { randomUUID } from 'crypto'

const MEDIA_PORT = 3001
let server: ReturnType<typeof createServer> | null = null

// Token map prevents path traversal — only explicitly registered files are served
const tokenMap = new Map<string, string>()

function mimeFor(p: string): string {
  const ext = extname(p).toLowerCase()
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.m4a') return 'audio/mp4'
  if (ext === '.ogg') return 'audio/ogg'
  if (ext === '.wav') return 'audio/wav'
  if (ext === '.flac') return 'audio/flac'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.mkv') return 'video/x-matroska'
  return 'application/octet-stream'
}

function getLocalIP(): string {
  const nets = networkInterfaces()
  for (const ifaces of Object.values(nets)) {
    if (!ifaces) continue
    for (const iface of ifaces) {
      if (!iface.internal && iface.family === 'IPv4') return iface.address
    }
  }
  return '127.0.0.1'
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  // URL: /media/<token>
  if (!req.url?.startsWith('/media/')) {
    res.writeHead(404)
    res.end()
    return
  }

  const token = req.url.slice('/media/'.length)
  const filePath = tokenMap.get(token)
  if (!filePath) {
    res.writeHead(404)
    res.end()
    return
  }

  let stat: ReturnType<typeof statSync>
  try {
    stat = statSync(filePath)
  } catch {
    res.writeHead(404)
    res.end()
    return
  }

  const range = req.headers['range']

  const headers: Record<string, string | number> = {
    'Content-Type': mimeFor(filePath),
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
  }

  if (range) {
    const [startStr, endStr] = range.replace('bytes=', '').split('-')
    const start = parseInt(startStr, 10)
    const end = endStr ? parseInt(endStr, 10) : stat.size - 1
    if (isNaN(start) || isNaN(end) || start > end || end >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` })
      res.end()
      return
    }
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Length': end - start + 1,
    })
    createReadStream(filePath, { start, end }).pipe(res)
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': stat.size })
    createReadStream(filePath).pipe(res)
  }
}

export function startMediaServer(): Promise<{ port: number; getUrl: (filePath: string) => string }> {
  return new Promise((resolve, reject) => {
    if (server) {
      const ip = getLocalIP()
      resolve({
        port: MEDIA_PORT,
        getUrl: (p) => {
          const token = randomUUID()
          tokenMap.set(token, p)
          return `http://${ip}:${MEDIA_PORT}/media/${token}`
        },
      })
      return
    }

    server = createServer(handleRequest)
    server.listen(MEDIA_PORT, '0.0.0.0', () => {
      const ip = getLocalIP()
      resolve({
        port: MEDIA_PORT,
        getUrl: (filePath: string) => {
          const token = randomUUID()
          tokenMap.set(token, filePath)
          return `http://${ip}:${MEDIA_PORT}/media/${token}`
        },
      })
    })
    server.on('error', reject)
  })
}

export function stopMediaServer(): void {
  server?.close()
  server = null
  tokenMap.clear()
}
