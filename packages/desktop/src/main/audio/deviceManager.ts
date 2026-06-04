import { IpcMain } from 'electron'

export interface AudioDevice {
  id: string
  name: string
  type: 'input' | 'output'
  isDefault: boolean
}

let currentOutputDeviceId: string | null = null
let currentInputDeviceId: string | null = null

/**
 * On macOS/Windows we rely on the renderer's Web Audio API (getUserMedia +
 * setSinkId) for actual routing. This module only tracks selections and
 * exposes them via IPC so the renderer can apply them.
 *
 * Device enumeration uses the renderer's mediaDevices.enumerateDevices() —
 * we shuttle that list back through IPC so the main process can persist
 * the user's preferences.
 */
export function registerAudioHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('audio:get-devices', () => ({
    outputDeviceId: currentOutputDeviceId,
    inputDeviceId: currentInputDeviceId,
  }))

  ipcMain.handle('audio:set-output', (_e, deviceId: string) => {
    currentOutputDeviceId = deviceId
    return { success: true }
  })

  ipcMain.handle('audio:set-input', (_e, deviceId: string) => {
    currentInputDeviceId = deviceId
    return { success: true }
  })
}
