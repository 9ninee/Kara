import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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
  showOpenDialog: (options: {
    title?: string
    filters?: { name: string; extensions: string[] }[]
    properties?: string[]
  }) => ipcRenderer.invoke('dialog:open', options),

  // Providers: YouTube
  searchYoutube: (query: string) => ipcRenderer.invoke('provider:youtube-search', query),
  downloadYoutube: (url: string, title: string) =>
    ipcRenderer.invoke('provider:youtube-download', url, title),

  // Providers: Karaoke API
  configureKaraokeApi: (baseUrl: string, apiKey: string, name?: string) =>
    ipcRenderer.invoke('karaoke-api:configure', baseUrl, apiKey, name),
  searchKaraokeApi: (query: string) => ipcRenderer.invoke('karaoke-api:search', query),
  getKaraokeApiStatus: () => ipcRenderer.invoke('karaoke-api:status'),

  // Casting: Chromecast
  discoverChromecast: () => ipcRenderer.invoke('cast:discover-chromecast'),
  castToChromecast: (device: unknown, filePath: string) =>
    ipcRenderer.invoke('cast:connect-chromecast', device, filePath),
  castPause: () => ipcRenderer.invoke('cast:pause'),
  castResume: () => ipcRenderer.invoke('cast:resume'),
  castSeek: (secs: number) => ipcRenderer.invoke('cast:seek', secs),
  stopCasting: () => ipcRenderer.invoke('cast:stop'),
  getCastStatus: () => ipcRenderer.invoke('cast:status'),

  // Party mode
  startParty: () => ipcRenderer.invoke('party:start') as Promise<{ sessionId: string; port: number; qrDataUrl: string }>,
  stopParty: () => ipcRenderer.invoke('party:stop'),

  // IPC event listeners (main → renderer push events)
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
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
