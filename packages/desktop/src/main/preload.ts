import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

/** Convert an absolute local path to a kara:// URL the renderer can fetch */
function getLocalFileUrl(absPath: string): string {
  const normalized = absPath.replace(/\\/g, '/')
  return `kara://local${normalized.startsWith('/') ? normalized : '/' + normalized}`
}

const api = {
  // Audio devices
  getAudioDevices: () => ipcRenderer.invoke('audio:get-devices'),
  setOutputDevice: (deviceId: string) => ipcRenderer.invoke('audio:set-output', deviceId),
  setInputDevice: (deviceId: string) => ipcRenderer.invoke('audio:set-input', deviceId),

  // Library
  getSongs: (query?: string) => ipcRenderer.invoke('library:get-songs', query),
  addSong: (filePaths: string[]) => ipcRenderer.invoke('library:add-songs', filePaths),
  deleteSong: (songId: string) => ipcRenderer.invoke('library:delete-song', songId),
  importFolder: (folderPath: string) => ipcRenderer.invoke('library:import-folder', folderPath),

  // File system
  getLocalFileUrl,
  showOpenDialog: (options: { title?: string; filters?: { name: string; extensions: string[] }[]; properties?: string[] }) =>
    ipcRenderer.invoke('dialog:open', options),

  // Providers
  searchYoutube: (query: string) => ipcRenderer.invoke('provider:youtube-search', query),
  downloadYoutube: (url: string, title: string) =>
    ipcRenderer.invoke('provider:youtube-download', url, title),
  searchKaraoke: (query: string) => ipcRenderer.invoke('karaoke:search', query),
  downloadKaraoke: (trackId: string) => ipcRenderer.invoke('karaoke:download', trackId),
  configureKaraokeApi: (baseUrl: string, apiKey: string) =>
    ipcRenderer.invoke('karaoke:configure', baseUrl, apiKey),

  // Casting
  discoverChromecast: () => ipcRenderer.invoke('cast:discover-chromecast'),
  castToChromecast: (deviceId: string, mediaUrl: string) =>
    ipcRenderer.invoke('cast:connect-chromecast', deviceId, mediaUrl),
  stopCasting: () => ipcRenderer.invoke('cast:stop'),

  // Party mode
  startParty: () => ipcRenderer.invoke('party:start'),
  stopParty: () => ipcRenderer.invoke('party:stop'),

  // Event listeners
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, (_event, ...args) => callback(...args))
  },
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}

export type KaraAPI = typeof api
