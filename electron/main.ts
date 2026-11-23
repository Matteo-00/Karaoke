/**
 * Studio Karaoke – processo principale.
 * Finestra a schermo intero senza bordi, istanza singola, avvio automatico,
 * riavvio in caso di crash e IPC tipizzato.
 */
import { app, BrowserWindow, ipcMain, session } from 'electron'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { IPC, type AppInfo } from './ipc-types'
import { settings } from './settings'

// __dirname è fornito da electron-vite anche nel bundle ESM

const isDev = !app.isPackaged
/** In sviluppo si può usare una finestra normale 1366×768: STUDIO_WINDOWED=1 */
const windowed = process.env.STUDIO_WINDOWED === '1'

let mainWindow: BrowserWindow | null = null
/** Evita di riavviare all'infinito se il renderer crasha in loop */
let recentCrashes: number[] = []

function log(...args: unknown[]): void {
  console.log('[studio]', new Date().toISOString(), ...args)
}

// ---------------------------------------------------------------- istanza singola
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
  app.whenReady().then(onReady)
}

// ---------------------------------------------------------------- avvio automatico
function applyAutoStart(): void {
  // Solo per l'app installata: in sviluppo non registriamo l'avvio con Windows
  if (!app.isPackaged || process.platform !== 'win32') return
  app.setLoginItemSettings({ openAtLogin: settings.get('autoStart') })
}

// ---------------------------------------------------------------- finestra
function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    show: false,
    frame: false,
    fullscreen: !windowed,
    kiosk: !windowed && !isDev,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a24',
    title: settings.get('appName'),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })

  win.setMenu(null)
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  // Nessuna nuova finestra: i link esterni non devono mai portare fuori dall'app
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault()
  })

  // Blocca le scorciatoie che potrebbero "rompere" l'app (ricarica, zoom, devtools)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const key = input.key.toLowerCase()
    const ctrl = input.control || input.meta
    if (isDev && key === 'f12') {
      win.webContents.toggleDevTools()
      event.preventDefault()
      return
    }
    const blocked =
      (ctrl && ['r', 'w', 'q', '+', '-', '=', '0'].includes(key)) ||
      key === 'f5' ||
      key === 'f11' ||
      (input.alt && key === 'f4' && !isDev)
    if (blocked && !isDev) event.preventDefault()
  })

  // Se il renderer muore, lo ricarichiamo (max 3 volte al minuto, poi riavvio completo)
  win.webContents.on('render-process-gone', (_event, details) => {
    log('renderer terminato:', details.reason)
    if (details.reason === 'clean-exit') return
    const now = Date.now()
    recentCrashes = recentCrashes.filter((t) => now - t < 60_000).concat(now)
    if (recentCrashes.length > 3) {
      relaunch()
    } else if (!win.isDestroyed()) {
      win.webContents.reload()
    }
  })
  win.on('unresponsive', () => {
    log('finestra bloccata: ricarico')
    setTimeout(() => {
      if (!win.isDestroyed()) win.webContents.forcefullyCrashRenderer()
    }, 10_000)
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

function isAppUrl(url: string): boolean {
  if (url.startsWith('file://')) return true
  const devUrl = process.env.ELECTRON_RENDERER_URL
  return !!devUrl && url.startsWith(devUrl)
}

function relaunch(): void {
  log('riavvio completo dell\'app')
  app.relaunch()
  app.exit(0)
}

// ---------------------------------------------------------------- permessi
function setupPermissions(): void {
  // Microfono/mixer: concesso solo all'interfaccia dell'app (serve anche per
  // leggere i nomi dei dispositivi e capire se il mixer è collegato)
  const ses = session.defaultSession
  ses.setPermissionRequestHandler((wc, permission, callback) => {
    callback(permission === 'media' && isAppUrl(wc.getURL()))
  })
  ses.setPermissionCheckHandler((_wc, permission, origin) => {
    return permission === 'media' && (origin.startsWith('file://') || isAppUrl(origin))
  })
}

// ---------------------------------------------------------------- IPC
function registerIpc(): void {
  ipcMain.handle(IPC.getInfo, (): AppInfo => ({
    appName: settings.get('appName'),
    version: app.getVersion(),
    isDev,
    platform: process.platform,
    theme: settings.get('theme')
  }))

  ipcMain.handle(IPC.quitApp, () => {
    log('chiusura richiesta dall\'utente')
    app.quit()
  })

  ipcMain.handle(IPC.shutdownPc, async () => {
    log('spegnimento del PC richiesto')
    if (process.platform !== 'win32') {
      // Fuori da Windows (sviluppo) non spegniamo davvero la macchina
      return { ok: false, message: 'Spegnimento disponibile solo su Windows' }
    }
    return new Promise<{ ok: boolean; message?: string }>((resolve) => {
      execFile('shutdown', ['/s', '/t', '0'], { windowsHide: true }, (err) => {
        if (err) {
          log('errore spegnimento:', err.message)
          resolve({ ok: false, message: err.message })
        } else {
          resolve({ ok: true })
        }
      })
    })
  })

  // Fase 1: l'indice delle registrazioni arriva nelle fasi 4-5
  ipcMain.handle(IPC.recordingCount, () => 0)
}

// ---------------------------------------------------------------- avvio
function onReady(): void {
  applyAutoStart()
  setupPermissions()
  registerIpc()
  mainWindow = createWindow()
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('child-process-gone', (_event, details) => {
  log('processo figlio terminato:', details.type, details.reason)
  // Se crasha la GPU, Chromium ne riavvia una nuova; se fallisce più volte riavviamo tutto
  if (details.type === 'GPU' && details.reason === 'crashed') {
    const now = Date.now()
    recentCrashes = recentCrashes.filter((t) => now - t < 60_000).concat(now)
    if (recentCrashes.length > 3) relaunch()
  }
})

process.on('uncaughtException', (err) => {
  log('errore non gestito:', err)
  if (app.isPackaged) relaunch()
})

app.on('window-all-closed', () => {
  app.quit()
})
