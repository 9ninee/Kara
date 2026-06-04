import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { initDatabase } from './library/database'
import { startPartyServer, stopPartyServer } from './server/partyServer'
import { registerAudioHandlers } from './audio/deviceManager'
import { registerLibraryHandlers } from './library/database'
import { registerProviderHandlers } from './providers/youtube'
import { registerCastingHandlers } from './casting/chromecast'

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

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

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
  await initDatabase()

  registerAudioHandlers(ipcMain)
  registerLibraryHandlers(ipcMain)
  registerProviderHandlers(ipcMain)
  registerCastingHandlers(ipcMain)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await stopPartyServer()
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('party:start', async () => {
  return startPartyServer()
})

ipcMain.handle('party:stop', async () => {
  return stopPartyServer()
})
