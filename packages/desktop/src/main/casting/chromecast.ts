import { IpcMain } from 'electron'
import { Bonjour } from 'bonjour-service'

export interface ChromecastDevice {
  id: string
  name: string
  host: string
  port: number
}

// Phase 5: full castv2 protocol client will be wired in here.
// For now we discover devices via mDNS (googlecast) and stub the cast call.

let bonjour: Bonjour | null = null

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

  ipcMain.handle('cast:connect-chromecast', async (_e, _device: ChromecastDevice, _mediaUrl: string) => {
    // Full castv2 protocol support lands in Phase 5.
    return { success: false, error: 'Chromecast casting coming in Phase 5.' }
  })

  ipcMain.handle('cast:stop', async () => {
    return { success: true }
  })
}
