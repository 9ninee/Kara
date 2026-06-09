import { createServer, IncomingMessage, ServerResponse } from 'http'
import { createReadStream, statSync } from 'fs'
import { extname } from 'path'
import { networkInterfaces } from 'os'
import { randomBytes } from 'crypto'

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.mp4': 'audio/mp4',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.cdg': 'application/octet-stream',
}

let server: ReturnType<typeof createServer> | null = null
let port = 0
let token = ''

export function getLocalIP(): string {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (!iface.internal && iface.family === 'IPv4') return iface.address
    }
  }
  return '127.0.0.1'
}

export async function startMediaServer(): Promise<{ port: number; token: string }> {
  if (server) return { port, token }

  token = randomBytes(16).toString('hex')

  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://localhost`)
    if (url.searchParams.get('t') !== token) {
      res.writeHead(403)
      res.end()
      return
    }

    const filePath = decodeURIComponent(url.pathname)
    try {
      const stat = statSync(filePath)
      const ext = extname(filePath).toLowerCase()
      const mime = MIME[ext] ?? 'application/octet-stream'
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
      })
      createReadStream(filePath).pipe(res)
    } catch {
      res.writeHead(404)
      res.end()
    }
  })

  await new Promise<void>((resolve) => {
    server!.listen(0, '0.0.0.0', () => {
      port = (server!.address() as { port: number }).port
      resolve()
    })
  })

  return { port, token }
}

export function fileUrl(absPath: string): string {
  const ip = getLocalIP()
  return `http://${ip}:${port}${absPath}?t=${token}`
}

export function stopMediaServer(): void {
  server?.close()
  server = null
  port = 0
  token = ''
}
