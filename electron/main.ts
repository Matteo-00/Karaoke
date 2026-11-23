/**
 * Studio Karaoke – processo principale.
 * Finestra a schermo intero senza bordi, istanza singola, avvio automatico,
 * riavvio in caso di crash e IPC tipizzato.
 */
import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { IPC, THEMES, type AppInfo, type StudioSettings, type ThemeId } from './ipc-types'
import { settings, SETTINGS_DEFAULTS } from './settings'
import { setupYouTube } from './youtube'
import { Library, defaultRoot } from './library'
import { copyToUsb, listUsbDrives, startPhoneShare, stopPhoneShare } from './share'
import { onVoiceStatus, transcribe, voiceStatus, warmUpVoice } from './voice'

// __dirname è fornito da electron-vite anche nel bundle ESM

const isDev = !app.isPackaged
/** In sviluppo si può usare una finestra normale 1366×768: STUDIO_WINDOWED=1 */
const windowed = process.env.STUDIO_WINDOWED === '1'

let mainWindow: BrowserWindow | null = null
/** Promessa che si risolve quando l'archivio è pronto */
let libraryReady: Promise<Library> | null = null

function startLibrary(): Promise<Library> {
  const root = settings.get('dataRoot') || defaultRoot()
  const lib = new Library(root, {
    bitrate: () => settings.get('mp3Bitrate'),
    log,
    onChange: () => mainWindow?.webContents.send(IPC.libChanged)
  })
  return lib.init().then(() => lib)
}
const lib = () => libraryReady ?? (libraryReady = startLibrary())
/** Evita di riavviare all'infinito se il renderer crasha in loop */
let recentCrashes: number[] = []

/** Registro su file (Impostazioni → Registro): pulizie del cestino, errori, salvataggi */
const logFile = () => join(app.getPath('userData'), 'registro.log')

function log(...args: unknown[]): void {
  const line = `${new Date().toISOString()} ${args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`
  console.log('[studio]', line)
  try {
    appendFileSync(logFile(), line + '\n')
  } catch {
    /* il registro non deve mai bloccare l'app */
  }
}

/** Tiene il registro piccolo (ultime ~2000 righe) */
function trimLog(): void {
  try {
    if (existsSync(logFile()) && statSync(logFile()).size > 256_000) {
      const lines = readFileSync(logFile(), 'utf8').split('\n')
      writeFileSync(logFile(), lines.slice(-2000).join('\n'))
    }
  } catch {
    /* ignorato */
  }
}

let youtube: { applyZoom: () => void } | null = null

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
    theme: settings.get('theme'),
    countdownSeconds: settings.get('countdownSeconds'),
    beep: settings.get('beep'),
    trashDays: settings.get('trashDays')
  }))

  // Impostazioni nascoste
  ipcMain.handle(IPC.setGet, () => ({
    ...settings.store,
    version: app.getVersion(),
    dataRootResolved: settings.get('dataRoot') || defaultRoot()
  }))
  ipcMain.handle(IPC.setSet, (_e, patch: Partial<StudioSettings>) => {
    const clean = sanitizeSettings(patch)
    for (const [k, v] of Object.entries(clean)) settings.set(k as keyof StudioSettings, v as never)
    if ('autoStart' in clean) applyAutoStart()
    if ('youtubeZoom' in clean) youtube?.applyZoom()
    if ('appName' in clean) mainWindow?.setTitle(settings.get('appName'))
    log('impostazioni cambiate:', Object.keys(clean).join(', ') || '-')
    return settings.store
  })
  ipcMain.handle(IPC.setOpenFolder, async () => {
    await shell.openPath(settings.get('dataRoot') || defaultRoot())
  })
  ipcMain.handle(IPC.setChooseFolder, async () => {
    if (!mainWindow) return null
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Cartella dei dati di Studio Karaoke',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: settings.get('dataRoot') || defaultRoot()
    })
    return res.canceled ? null : res.filePaths[0]
  })
  ipcMain.handle(IPC.setRestart, () => relaunch())
  ipcMain.handle(IPC.setLogs, () => {
    try {
      return readFileSync(logFile(), 'utf8').trim().split('\n').slice(-60).reverse()
    } catch {
      return []
    }
  })

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

  ipcMain.handle(IPC.setTheme, (_e, theme: ThemeId) => {
    if (THEMES.includes(theme)) settings.set('theme', theme)
  })

  ipcMain.handle(IPC.recordingCount, async () => (await lib()).count())
  ipcMain.handle(IPC.mixerHint, () => settings.get('mixerLabelHint'))

  // Registrazione: file temporaneo scritto a pezzi
  ipcMain.handle(IPC.recBegin, async (_e, meta) => (await lib()).beginTemp(meta))
  ipcMain.handle(IPC.recChunk, async (_e, id: string, data: ArrayBuffer) => (await lib()).appendTemp(id, data))
  ipcMain.handle(IPC.recFinish, async (_e, id: string, sec: number) => (await lib()).finishTemp(id, sec))
  ipcMain.handle(IPC.recOrphans, async () => (await lib()).orphans())

  // Archivio
  ipcMain.handle(IPC.libGet, async () => (await lib()).snapshot())
  ipcMain.handle(IPC.libSaveTemp, async (_e, a: { tempId: string; title: string; folder: string }) =>
    (await lib()).saveTemp(a.tempId, a.title, a.folder)
  )
  ipcMain.handle(IPC.libDiscardTemp, async (_e, id: string) => (await lib()).discardTemp(id))
  ipcMain.handle(IPC.libCreateFolder, async (_e, name: string) => (await lib()).createFolder(name))
  ipcMain.handle(IPC.libRenameFolder, async (_e, a: string, b: string) => (await lib()).renameFolder(a, b))
  ipcMain.handle(IPC.libDeleteFolder, async (_e, name: string) => (await lib()).deleteFolder(name))
  ipcMain.handle(IPC.libRename, async (_e, id: string, title: string) => (await lib()).rename(id, title))
  ipcMain.handle(IPC.libMove, async (_e, id: string, folder: string) => (await lib()).move(id, folder))
  ipcMain.handle(IPC.libFavorite, async (_e, id: string, fav: boolean) => (await lib()).setFavorite(id, fav))
  ipcMain.handle(IPC.libRemove, async (_e, id: string) => (await lib()).remove(id))
  ipcMain.handle(IPC.libRestore, async (_e, id: string) => (await lib()).restore(id))
  // Condivisione: telefono (Wi‑Fi di casa) e chiavetta USB
  ipcMain.handle(IPC.shareStartPhone, async (_e, ids: string[]) =>
    startPhoneShare((await lib()).filesFor(ids), (id) => mainWindow?.webContents.send(IPC.shareDownloaded, id))
  )
  ipcMain.handle(IPC.shareStopPhone, () => stopPhoneShare())
  ipcMain.handle(IPC.usbList, () => listUsbDrives())
  ipcMain.handle(IPC.usbCopy, async (_e, ids: string[], drive: string) => {
    const n = await copyToUsb((await lib()).filesFor(ids), drive)
    log(`copiate ${n} canzoni su ${drive}`)
    return n
  })
  // Voce (Whisper in locale)
  ipcMain.handle(IPC.voiceTranscribe, async (_e, samples: Float32Array) => transcribe(samples, log))
  ipcMain.handle(IPC.voiceStatus, () => voiceStatus())
  onVoiceStatus((s) => mainWindow?.webContents.send(IPC.voiceStatusEvent, s))

  ipcMain.handle(IPC.libPurge, async (_e, id: string) => (await lib()).purge(id))
  ipcMain.handle(IPC.libEmptyTrash, async () => (await lib()).emptyTrash())
  ipcMain.handle(IPC.libReadAudio, async (_e, id: string) => {
    const buf = await (await lib()).readAudio(id)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  })
}

// ---------------------------------------------------------------- avvio
function onReady(): void {
  applyAutoStart()
  setupPermissions()
  trimLog()
  log(`avvio di Studio Karaoke ${app.getVersion()}`)
  registerIpc()
  // Il modello della voce si prepara in sottofondo, dopo l'avvio
  setTimeout(() => warmUpVoice(log), 15_000)
  lib()
    .then(() => scheduleCleanup())
    .catch((err) => log('errore archivio:', err))
  mainWindow = createWindow()
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  youtube = setupYouTube({
    window: () => mainWindow,
    preload: join(__dirname, '../preload/youtube-preload.cjs'),
    // STUDIO_YT_URL permette di provare l'app con una pagina di test (vedi dev/finto-youtube)
    url: () => process.env.STUDIO_YT_URL || settings.get('youtubeUrl'),
    voiceKeys: () => voiceKeys(),
    zoom: () => settings.get('youtubeZoom'),
    log
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

/** Tasti che avviano la ricerca vocale (quelli standard + quello scelto nelle impostazioni) */
export function voiceKeys(): string[] {
  const custom = settings.get('voiceKey')
  return ['BrowserSearch', 'LaunchAssistant', 'MicrophoneToggle', 'F24', ...(custom ? [custom] : [])]
}

/** Pulizia delle registrazioni eliminate: all'avvio e poi ogni 6 ore */
function scheduleCleanup(): void {
  const run = async () => {
    try {
      // STUDIO_TRASH_NOW permette di simulare una data futura per le prove
      const now = process.env.STUDIO_TRASH_NOW ? Date.parse(process.env.STUDIO_TRASH_NOW) : Date.now()
      await (await lib()).cleanupExpired(settings.get('trashDays'), now)
    } catch (err) {
      log('errore pulizia automatica:', err)
    }
  }
  run()
  setInterval(run, 6 * 60 * 60_000)
}

/** Accetta solo valori sensati (le impostazioni arrivano dall'interfaccia) */
function sanitizeSettings(p: Partial<StudioSettings>): Partial<StudioSettings> {
  const out: Partial<StudioSettings> = {}
  const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
  if (typeof p.appName === 'string' && p.appName.trim()) out.appName = p.appName.trim().slice(0, 40)
  if (typeof p.autoStart === 'boolean') out.autoStart = p.autoStart
  if (typeof p.mixerLabelHint === 'string') out.mixerLabelHint = p.mixerLabelHint.slice(0, 200) || SETTINGS_DEFAULTS.mixerLabelHint
  if (typeof p.voiceMicLabel === 'string') out.voiceMicLabel = p.voiceMicLabel.slice(0, 200)
  if (p.theme && THEMES.includes(p.theme)) out.theme = p.theme
  if (num(p.youtubeZoom, 0.8, 2.5)) out.youtubeZoom = p.youtubeZoom
  if (num(p.countdownSeconds, 1, 15)) out.countdownSeconds = Math.round(p.countdownSeconds!)
  if (typeof p.beep === 'boolean') out.beep = p.beep
  if (typeof p.dataRoot === 'string') out.dataRoot = p.dataRoot
  if (num(p.mp3Bitrate, 96, 320)) out.mp3Bitrate = Math.round(p.mp3Bitrate!)
  if (num(p.trashDays, 1, 365)) out.trashDays = Math.round(p.trashDays!)
  if (typeof p.voiceKey === 'string') out.voiceKey = p.voiceKey.slice(0, 40)
  if (typeof p.voiceAuto === 'boolean') out.voiceAuto = p.voiceAuto
  return out
}

app.on('before-quit', () => {
  void stopPhoneShare()
})

app.on('window-all-closed', () => {
  app.quit()
})
