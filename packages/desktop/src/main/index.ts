import { app, BrowserWindow, ipcMain, shell, protocol, net, dialog } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { initDatabase } from './library/database'
import { startPartyServer, stopPartyServer } from './server/partyServer'
import { startMediaServer, stopMediaServer } from './server/mediaServer'
import { registerAudioHandlers } from './audio/deviceManager'
import { registerLibraryHandlers } from './library/database'
import { registerProviderHandlers } from './providers/youtube'
import { registerCastingHandlers } from './casting/chromecast'
import { registerKaraokeApiHandlers } from './providers/karaokeApi'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'kara',
    privileges: { standard: true, secure: true, bypassCSP: true, supportFetchAPI: true, stream: true },
  },
])

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => mainWindow!.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  protocol.handle('kara', (request) => {
    const filePath = request.url.slice('kara://local'.length)
    return net.fetch(`file://${filePath}`)
  })

  await initDatabase()
  await startMediaServer()

  registerAudioHandlers(ipcMain)
  registerLibraryHandlers(ipcMain)
  registerProviderHandlers(ipcMain)
  registerCastingHandlers(ipcMain)
  registerKaraokeApiHandlers(ipcMain)

  ipcMain.handle('dialog:open', (_e, options: Electron.OpenDialogOptions) =>
    dialog.showOpenDialog(mainWindow!, options),
  )

  ipcMain.handle('party:start', async () => {
    const result = await startPartyServer((queue) => {
      mainWindow?.webContents.send('queue:updated', queue)
    })
    return result
  })

  ipcMain.handle('party:stop', async () => {
    await stopPartyServer()
    mainWindow?.webContents.send('queue:updated', { items: [], nowPlaying: null, history: [] })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await stopPartyServer()
  stopMediaServer()
  if (process.platform !== 'darwin') app.quit()
})
