import { IpcMain } from 'electron'
import { Bonjour } from 'bonjour-service'
import { Client } from 'castv2'
import { startMediaServer, stopMediaServer, fileUrl } from './mediaServer'

export interface ChromecastDevice {
  id: string
  name: string
  host: string
  port: number
}

const SENDER_ID = 'sender-0'
const RECEIVER_ID = 'receiver-0'
const DEFAULT_MEDIA_RECEIVER_APP = 'CC1AD845'

let bonjour: Bonjour | null = null
let castClient: InstanceType<typeof Client> | null = null

interface ReceiverStatus {
  applications?: Array<{ appId: string; transportId: string; sessionId: string }>
}

function castConnect(host: string, port: number): Promise<InstanceType<typeof Client>> {
  return new Promise((resolve, reject) => {
    const client = new Client()
    client.connect({ host, port }, () => resolve(client))
    client.once('error', reject)
  })
}

function sendMessage(
  client: InstanceType<typeof Client>,
  sourceId: string,
  destinationId: string,
  namespace: string,
  data: object,
): void {
  const channel = client.createChannel(sourceId, destinationId, namespace, 'JSON')
  channel.send(data)
}

function launchApp(client: InstanceType<typeof Client>): Promise<string> {
  return new Promise((resolve, reject) => {
    const heartbeat = client.createChannel(SENDER_ID, RECEIVER_ID, 'urn:x-cast:com.google.cast.tp.heartbeat', 'JSON')
    const connection = client.createChannel(SENDER_ID, RECEIVER_ID, 'urn:x-cast:com.google.cast.tp.connection', 'JSON')
    const receiver = client.createChannel(SENDER_ID, RECEIVER_ID, 'urn:x-cast:com.google.cast.receiver', 'JSON')

    connection.send({ type: 'CONNECT' })

    const pingInterval = setInterval(() => heartbeat.send({ type: 'PING' }), 5000)

    let reqId = 1
    receiver.send({ type: 'LAUNCH', appId: DEFAULT_MEDIA_RECEIVER_APP, requestId: reqId++ })

    receiver.on('message', (data: ReceiverStatus & { type: string }) => {
      if (data.type === 'RECEIVER_STATUS') {
        const app = data.applications?.find((a) => a.appId === DEFAULT_MEDIA_RECEIVER_APP)
        if (app) {
          clearInterval(pingInterval)
          resolve(app.transportId)
        }
      }
    })

    setTimeout(() => {
      clearInterval(pingInterval)
      reject(new Error('Launch timeout'))
    }, 15000)
  })
}

function loadMedia(client: InstanceType<typeof Client>, transportId: string, mediaUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const connection = client.createChannel(SENDER_ID, transportId, 'urn:x-cast:com.google.cast.tp.connection', 'JSON')
    const media = client.createChannel(SENDER_ID, transportId, 'urn:x-cast:com.google.cast.media', 'JSON')

    connection.send({ type: 'CONNECT' })

    const ext = mediaUrl.split('?')[0].split('.').pop()?.toLowerCase()
    const contentType = ext === 'mp3' ? 'audio/mpeg' : ext === 'mp4' ? 'audio/mp4' : 'audio/mpeg'

    media.send({
      type: 'LOAD',
      requestId: 1,
      media: {
        contentId: mediaUrl,
        contentType,
        streamType: 'BUFFERED',
      },
      autoplay: true,
      currentTime: 0,
    })

    media.on('message', (data: { type: string }) => {
      if (data.type === 'MEDIA_STATUS') resolve()
    })

    setTimeout(() => reject(new Error('Load timeout')), 10000)
  })
}

export function registerCastingHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('cast:discover-chromecast', async (): Promise<ChromecastDevice[]> => {
    if (bonjour) bonjour.destroy()
    bonjour = new Bonjour()
    const devices: ChromecastDevice[] = []

    return new Promise((resolve) => {
      const browser = bonjour!.find({ type: 'googlecast' }, (service) => {
        devices.push({
          id: (service.txt as Record<string, string>)?.id ?? service.name,
          name: service.name,
          host: service.host,
          port: service.port,
        })
      })
      setTimeout(() => {
        browser.stop()
        resolve(devices)
      }, 3000)
    })
  })

  ipcMain.handle('cast:connect-chromecast', async (_e, device: ChromecastDevice, absPath: string) => {
    try {
      await startMediaServer()
      const mediaUrl = fileUrl(absPath)

      if (castClient) castClient.close()
      castClient = await castConnect(device.host, device.port)

      const transportId = await launchApp(castClient)
      await loadMedia(castClient, transportId, mediaUrl)

      return { success: true, mediaUrl }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('cast:stop', async () => {
    if (castClient) {
      sendMessage(castClient, SENDER_ID, RECEIVER_ID, 'urn:x-cast:com.google.cast.receiver', { type: 'STOP', requestId: 99 })
      castClient.close()
      castClient = null
    }
    stopMediaServer()
    return { success: true }
  })
}
