import { createServer, IncomingMessage, ServerResponse } from 'http'
import { createReadStream, statSync, existsSync } from 'fs'
import { extname } from 'path'
import { networkInterfaces } from 'os'

const MEDIA_PORT = 3001
let server: ReturnType<typeof createServer> | null = null

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
  // URL: /file/<encoded-absolute-path>
  if (!req.url?.startsWith('/file/')) {
    res.writeHead(404)
    res.end()
    return
  }

  const filePath = decodeURIComponent(req.url.slice('/file/'.length - 1))
  if (!existsSync(filePath)) {
    res.writeHead(404)
    res.end()
    return
  }

  const stat = statSync(filePath)
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
      resolve({ port: MEDIA_PORT, getUrl: (p) => `http://${ip}:${MEDIA_PORT}/file${encodeURIComponent(p)}` })
      return
    }

    server = createServer(handleRequest)
    server.listen(MEDIA_PORT, '0.0.0.0', () => {
      const ip = getLocalIP()
      resolve({
        port: MEDIA_PORT,
        getUrl: (filePath: string) => `http://${ip}:${MEDIA_PORT}/file${encodeURIComponent(filePath)}`,
      })
    })
    server.on('error', reject)
  })
}

export function stopMediaServer(): void {
  server?.close()
  server = null
}
