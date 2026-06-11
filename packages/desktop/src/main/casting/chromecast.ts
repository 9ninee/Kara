import { connect } from 'tls'
import { EventEmitter } from 'events'
import { IpcMain } from 'electron'
import { Bonjour } from 'bonjour-service'
import { startMediaServer } from '../server/mediaServer'

// ── Cast protocol namespaces ───────────────────────────────────────────────
const NS_CONNECTION = 'urn:x-cast:com.google.cast.tp.connection'
const NS_HEARTBEAT = 'urn:x-cast:com.google.cast.tp.heartbeat'
const NS_RECEIVER = 'urn:x-cast:com.google.cast.receiver'
const NS_MEDIA = 'urn:x-cast:com.google.cast.media'
const DEFAULT_RECEIVER_APP_ID = 'CC1AD845'

// ── Minimal protobuf encoder for CastMessage ──────────────────────────────

function encodeVarint(n: number): number[] {
  const out: number[] = []
  while (n > 0x7f) { out.push((n & 0x7f) | 0x80); n >>>= 7 }
  out.push(n)
  return out
}

function encodeStr(fieldNum: number, str: string): number[] {
  const bytes = Buffer.from(str, 'utf8')
  const tag = encodeVarint((fieldNum << 3) | 2)
  const len = encodeVarint(bytes.length)
  return [...tag, ...len, ...bytes]
}

function encodeInt(fieldNum: number, val: number): number[] {
  return [...encodeVarint((fieldNum << 3) | 0), ...encodeVarint(val)]
}

function buildMessage(sourceId: string, destId: string, ns: string, payload: string): Buffer {
  const body = Buffer.from([
    ...encodeInt(1, 0),
    ...encodeStr(2, sourceId),
    ...encodeStr(3, destId),
    ...encodeStr(4, ns),
    ...encodeInt(5, 0),
    ...encodeStr(6, payload),
  ])
  const hdr = Buffer.allocUnsafe(4)
  hdr.writeUInt32BE(body.length, 0)
  return Buffer.concat([hdr, body])
}

// ── Minimal protobuf decoder ───────────────────────────────────────────────

interface CastMsg { sourceId: string; destinationId: string; namespace: string; payload: string }

function parseMessages(chunk: Buffer, buf: Buffer): { msgs: CastMsg[]; buf: Buffer } {
  buf = Buffer.concat([buf, chunk])
  const msgs: CastMsg[] = []
  while (buf.length >= 4) {
    const len = buf.readUInt32BE(0)
    if (buf.length < 4 + len) break
    const msgBuf = buf.slice(4, 4 + len)
    buf = buf.slice(4 + len)

    const m: Partial<CastMsg> = {}
    let off = 0
    while (off < msgBuf.length) {
      let b = msgBuf[off++]
      const fieldNum = b >> 3
      const wire = b & 7
      if (wire === 0) {
        let v = 0, shift = 0
        do { b = msgBuf[off++]; v |= (b & 0x7f) << shift; shift += 7 } while (b & 0x80)
      } else if (wire === 2) {
        let l = 0, shift = 0
        do { b = msgBuf[off++]; l |= (b & 0x7f) << shift; shift += 7 } while (b & 0x80)
        const s = msgBuf.slice(off, off + l).toString('utf8')
        off += l
        if (fieldNum === 2) m.sourceId = s
        else if (fieldNum === 3) m.destinationId = s
        else if (fieldNum === 4) m.namespace = s
        else if (fieldNum === 6) m.payload = s
      } else break
    }
    if (m.namespace && m.payload !== undefined) msgs.push(m as CastMsg)
  }
  return { msgs, buf }
}

// ── Chromecast session ─────────────────────────────────────────────────────

export class ChromecastSession extends EventEmitter {
  private sock: ReturnType<typeof connect> | null = null
  private buf = Buffer.alloc(0)
  private reqId = 1
  private transportId: string | null = null
  private mediaSessionId: number | null = null

  connect(host: string, port = 8009): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sock = connect(port, host, { rejectUnauthorized: false }, () => {
        this.send('sender-0', 'receiver-0', NS_CONNECTION,
          JSON.stringify({ type: 'CONNECT', userAgent: 'Kara/1.0' }))
        this.send('sender-0', 'receiver-0', NS_RECEIVER,
          JSON.stringify({ type: 'GET_STATUS', requestId: this.reqId++ }))
        resolve()
      })
      this.sock.on('data', (chunk: Buffer) => {
        const result = parseMessages(chunk, this.buf)
        this.buf = result.buf
        for (const msg of result.msgs) this.handleMsg(msg)
      })
      this.sock.on('error', (e) => { this.emit('error', e); reject(e) })
      this.sock.on('close', () => this.emit('disconnect'))
    })
  }

  private send(src: string, dst: string, ns: string, payload: string): void {
    this.sock?.write(buildMessage(src, dst, ns, payload))
  }

  private handleMsg(msg: CastMsg): void {
    try {
      const data: Record<string, unknown> = JSON.parse(msg.payload)
      if (msg.namespace === NS_HEARTBEAT && data['type'] === 'PING') {
        this.send('sender-0', 'receiver-0', NS_HEARTBEAT, JSON.stringify({ type: 'PONG' }))
        return
      }
      if (msg.namespace === NS_RECEIVER && data['type'] === 'RECEIVER_STATUS') {
        const apps = (data['status'] as Record<string, unknown>)?.['applications'] as Record<string, unknown>[] | undefined
        if (apps?.[0]) {
          this.transportId = apps[0]['transportId'] as string
          this.emit('app-launched', apps[0])
        }
        return
      }
      if (msg.namespace === NS_MEDIA && data['type'] === 'MEDIA_STATUS') {
        const statuses = data['status'] as Record<string, unknown>[] | undefined
        const s = statuses?.[0]
        if (s?.['mediaSessionId']) this.mediaSessionId = s['mediaSessionId'] as number
        this.emit('media-status', s)
        return
      }
      if (data['type'] === 'LAUNCH_ERROR') {
        this.emit('error', new Error(`Cast launch failed: ${data['reason']}`))
      }
    } catch { /* ignore parse errors */ }
  }

  async launchAndLoad(mediaUrl: string, contentType = 'audio/mpeg', title = 'Karaoke'): Promise<void> {
    this.send('sender-0', 'receiver-0', NS_RECEIVER,
      JSON.stringify({ type: 'LAUNCH', appId: DEFAULT_RECEIVER_APP_ID, requestId: this.reqId++ }))

    const transportId = await new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Cast launch timeout')), 15_000)
      this.once('app-launched', (app: Record<string, unknown>) => { clearTimeout(t); resolve(app['transportId'] as string) })
      this.once('error', (e: Error) => { clearTimeout(t); reject(e) })
    })

    this.send('sender-0', transportId, NS_CONNECTION,
      JSON.stringify({ type: 'CONNECT', userAgent: 'Kara/1.0' }))

    this.send('sender-0', transportId, NS_MEDIA, JSON.stringify({
      type: 'LOAD',
      requestId: this.reqId++,
      media: {
        contentId: mediaUrl,
        contentType,
        streamType: 'BUFFERED',
        metadata: { metadataType: 3, title },
      },
      autoplay: true,
    }))

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Cast load timeout')), 15_000)
      this.once('media-status', () => { clearTimeout(t); resolve() })
      this.once('error', (e: Error) => { clearTimeout(t); reject(e) })
    })
  }

  pause(): void {
    if (!this.transportId || !this.mediaSessionId) return
    this.send('sender-0', this.transportId, NS_MEDIA,
      JSON.stringify({ type: 'PAUSE', requestId: this.reqId++, mediaSessionId: this.mediaSessionId }))
  }

  resume(): void {
    if (!this.transportId || !this.mediaSessionId) return
    this.send('sender-0', this.transportId, NS_MEDIA,
      JSON.stringify({ type: 'PLAY', requestId: this.reqId++, mediaSessionId: this.mediaSessionId }))
  }

  seek(positionSecs: number): void {
    if (!this.transportId || !this.mediaSessionId) return
    this.send('sender-0', this.transportId, NS_MEDIA,
      JSON.stringify({ type: 'SEEK', requestId: this.reqId++, mediaSessionId: this.mediaSessionId, currentTime: positionSecs }))
  }

  stop(): void {
    if (this.transportId && this.sock) {
      this.send('sender-0', 'receiver-0', NS_RECEIVER,
        JSON.stringify({ type: 'STOP', requestId: this.reqId++ }))
    }
    this.sock?.end()
    this.sock = null
    this.transportId = null
    this.mediaSessionId = null
  }
}

// ── IPC handlers ────────────────────────────────────────────────────────────

export interface ChromecastDevice {
  id: string
  name: string
  host: string
  port: number
}

let bonjour: Bonjour | null = null
let activeSession: ChromecastSession | null = null
let activeDevice: ChromecastDevice | null = null

export function registerCastingHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('cast:discover-chromecast', async (): Promise<ChromecastDevice[]> => {
    if (bonjour) bonjour.destroy()
    bonjour = new Bonjour()
    const devices: ChromecastDevice[] = []

    return new Promise((resolve) => {
      const browser = bonjour!.find({ type: 'googlecast' }, (svc) => {
        devices.push({
          id: (svc.txt as Record<string, string>)?.['id'] ?? svc.name,
          name: svc.name,
          host: svc.host,
          port: svc.port,
        })
      })
      setTimeout(() => { browser.stop(); resolve(devices) }, 3000)
    })
  })

  ipcMain.handle('cast:connect-chromecast', async (_e, device: ChromecastDevice, filePath: string) => {
    try {
      if (activeSession) {
        activeSession.stop()
        activeSession = null
      }

      const { getUrl } = await startMediaServer()
      const mediaUrl = getUrl(filePath)

      const session = new ChromecastSession()
      await session.connect(device.host, device.port)
      await session.launchAndLoad(mediaUrl)

      activeSession = session
      activeDevice = device
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('cast:pause', () => { activeSession?.pause(); return { success: true } })
  ipcMain.handle('cast:resume', () => { activeSession?.resume(); return { success: true } })

  ipcMain.handle('cast:seek', (_e, positionSecs: number) => {
    activeSession?.seek(positionSecs)
    return { success: true }
  })

  ipcMain.handle('cast:stop', () => {
    activeSession?.stop()
    activeSession = null
    activeDevice = null
    return { success: true }
  })

  ipcMain.handle('cast:status', () => ({
    connected: !!activeSession,
    device: activeDevice,
  }))
}
