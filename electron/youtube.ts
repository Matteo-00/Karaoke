/**
 * YouTube dentro l'app: un WebContentsView con il sito completo di YouTube,
 * posizionato sopra l'area centrale della schermata "YouTube – Canta".
 *
 * Il view è nativo e sta sempre sopra all'interfaccia React: quando si apre un
 * dialog o il conto alla rovescia lo nascondiamo e l'interfaccia mostra al suo
 * posto un'immagine dell'ultimo fotogramma.
 */
import { BrowserWindow, WebContentsView, ipcMain, session } from 'electron'
import { IPC, type ViewBounds, type YtCommand, type YtEvent } from './ipc-types'

interface Options {
  window: () => BrowserWindow | null
  preload: string
  url: () => string
  zoom: () => number
  /** Tasti che avviano la ricerca vocale */
  voiceKeys: () => string[]
  log: (...args: unknown[]) => void
}

/** Domini in cui YouTube può navigare dentro il view */
const ALLOWED_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'consent.youtube.com',
  'accounts.google.com',
  'consent.google.com',
  '127.0.0.1',
  'localhost'
]

function isAllowed(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h))
  } catch {
    return false
  }
}

/** User agent di un normale Chrome: senza "Electron" YouTube funziona come nel browser */
function chromeUserAgent(): string {
  const os =
    process.platform === 'win32'
      ? 'Windows NT 10.0; Win64; x64'
      : process.platform === 'darwin'
        ? 'Macintosh; Intel Mac OS X 10_15_7'
        : 'X11; Linux x86_64'
  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`
}

export function setupYouTube(opts: Options): { applyZoom: () => void } {
  let view: WebContentsView | null = null
  let loaded = false

  const sendToUi = (ev: YtEvent) => {
    const win = opts.window()
    if (win && !win.isDestroyed()) win.webContents.send(IPC.ytEvent, ev)
  }

  function ensureView(): WebContentsView {
    if (view) return view
    const ses = session.fromPartition('persist:youtube')
    ses.setUserAgent(chromeUserAgent())
    // YouTube non deve chiedere microfono, notifiche o schermo intero
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))

    view = new WebContentsView({
      webPreferences: {
        preload: opts.preload,
        partition: 'persist:youtube',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false
      }
    })
    view.setBackgroundColor('#000000')
    const wc = view.webContents

    // Mai finestre nuove: i link si aprono nello stesso view (se sono di YouTube)
    wc.setWindowOpenHandler(({ url }) => {
      if (isAllowed(url)) wc.loadURL(url)
      return { action: 'deny' }
    })
    wc.on('will-navigate', (event, url) => {
      if (!isAllowed(url)) event.preventDefault()
    })

    // Zoom per la TV (va riapplicato a ogni caricamento)
    wc.on('dom-ready', () => wc.setZoomFactor(opts.zoom()))

    // Tasti del telecomando mentre si è dentro YouTube:
    // Indietro e Home li gestisce l'app, il resto (frecce, scrittura) va a YouTube
    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return
      if (input.key === 'Escape' || input.key === 'BrowserBack' || input.key === 'GoBack') {
        event.preventDefault()
        sendToUi({ type: 'key', key: 'back' })
      } else if (opts.voiceKeys().includes(input.key) || opts.voiceKeys().includes(input.code)) {
        event.preventDefault()
        sendToUi({ type: 'key', key: 'voice' })
      } else if (input.key === 'MediaStop') {
        event.preventDefault()
        sendToUi({ type: 'key', key: 'stop' })
      } else if (input.key === 'BrowserHome') {
        event.preventDefault()
        sendToUi({ type: 'key', key: 'home' })
      }
    })

    wc.on('focus', () => sendToUi({ type: 'focus', youtube: true }))
    wc.on('blur', () => sendToUi({ type: 'focus', youtube: false }))

    wc.on('render-process-gone', (_e, details) => {
      opts.log('YouTube terminato:', details.reason)
      if (details.reason !== 'clean-exit') wc.reload()
    })

    opts.window()?.contentView.addChildView(view)
    view.setVisible(false)
    return view
  }

  // Eventi dallo script di preload di YouTube → interfaccia (solo dal nostro view)
  ipcMain.on(IPC.ytFromPage, (event, payload: YtEvent) => {
    if (view && event.sender === view.webContents) sendToUi(payload)
  })

  ipcMain.handle(IPC.ytShow, (_e, bounds: ViewBounds) => {
    const v = ensureView()
    v.setBounds(roundBounds(bounds))
    v.setVisible(true)
    if (!loaded) {
      loaded = true
      v.webContents.loadURL(opts.url())
    }
    v.webContents.focus()
  })

  ipcMain.handle(IPC.ytBounds, (_e, bounds: ViewBounds) => {
    view?.setBounds(roundBounds(bounds))
  })

  ipcMain.handle(IPC.ytHide, async (_e, snapshot: boolean) => {
    if (!view) return null
    let image: string | null = null
    if (snapshot && view.getVisible() && loaded) {
      try {
        const img = await view.webContents.capturePage()
        if (!img.isEmpty()) image = 'data:image/jpeg;base64,' + img.toJPEG(75).toString('base64')
      } catch (err) {
        opts.log('foto di YouTube non riuscita:', err)
      }
    }
    view.setVisible(false)
    opts.window()?.webContents.focus()
    return image
  })

  ipcMain.handle(IPC.ytCommand, (_e, cmd: YtCommand) => {
    view?.webContents.send(IPC.ytCommand, cmd)
  })

  ipcMain.handle(IPC.ytSearch, (_e, text: string) => {
    const v = ensureView()
    const base = new URL(opts.url())
    loaded = true
    v.webContents.loadURL(`${base.origin}/results?search_query=${encodeURIComponent(text.trim())}`)
  })

  ipcMain.handle(IPC.ytGoBack, () => {
    const history = view?.webContents.navigationHistory
    if (history?.canGoBack()) {
      history.goBack()
      return true
    }
    return false
  })

  return {
    /** Riapplica lo zoom (cambiato dalle impostazioni) */
    applyZoom: () => view?.webContents.setZoomFactor(opts.zoom())
  }
}

function roundBounds(b: ViewBounds): ViewBounds {
  return {
    x: Math.round(b.x),
    y: Math.round(b.y),
    width: Math.max(0, Math.round(b.width)),
    height: Math.max(0, Math.round(b.height))
  }
}
