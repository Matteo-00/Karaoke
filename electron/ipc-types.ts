/**
 * Contratto IPC tipizzato tra processo principale e interfaccia.
 * È l'unico punto di contatto: l'interfaccia non ha accesso a Node.
 */

export interface AppInfo {
  /** Nome mostrato in alto a sinistra (configurabile) */
  appName: string
  version: string
  /** true quando l'app gira dal sorgente (npm run dev) */
  isDev: boolean
  platform: NodeJS.Platform
  /** Tema grafico (vedi src/styles/themes.css) */
  theme: ThemeId
  /** Secondi del conto alla rovescia prima di registrare */
  countdownSeconds: number
}

/** Rettangolo (in pixel CSS della finestra) dove mostrare YouTube */
export interface ViewBounds {
  x: number
  y: number
  width: number
  height: number
}

/** Comandi inviati al player di YouTube */
export type YtCommand =
  | 'play' // riprende il video (fine dell'attesa)
  | 'pause'
  | 'hold' // mette in pausa e trattiene il video finché la UI non decide
  | 'restart' // riporta il video all'inizio
  | 'release' // smette di trattenere il video (resta in pausa)
  | 'forget' // il prossimo play dello stesso video chiede di nuovo

/** Eventi che arrivano da YouTube (script di preload) o dal processo principale */
export type YtEvent =
  | { type: 'video-start'; videoId: string; title: string; duration: number }
  | { type: 'meta'; videoId: string; title: string }
  | {
      type: 'state'
      videoId: string | null
      title: string
      playing: boolean
      ad: boolean
      ended: boolean
      duration: number
    }
  | { type: 'ended'; videoId: string }
  | { type: 'key'; key: 'back' | 'home' }
  /** YouTube ha preso (true) o perso (false) il focus della tastiera */
  | { type: 'focus'; youtube: boolean }

export interface YouTubeApi {
  /** Mostra YouTube nel rettangolo indicato (lo carica la prima volta) */
  show(bounds: ViewBounds): Promise<void>
  setBounds(bounds: ViewBounds): Promise<void>
  /** Nasconde YouTube; con snapshot=true restituisce un'immagine dell'ultimo fotogramma */
  hide(snapshot: boolean): Promise<string | null>
  command(cmd: YtCommand): Promise<void>
  /** Indietro nella cronologia di YouTube: false se non c'è cronologia */
  goBack(): Promise<boolean>
  /** Registra un ascoltatore degli eventi; restituisce la funzione per rimuoverlo */
  onEvent(cb: (e: YtEvent) => void): () => void
}

export const THEMES = ['ardesia', 'ardesia-giorno', 'palco', 'corallo', 'cielo', 'salvia', 'vinile'] as const

/** Coppie notte ⇄ giorno usate dal pulsante in Home */
export const DAY_NIGHT: Partial<Record<ThemeId, ThemeId>> = {
  ardesia: 'ardesia-giorno',
  'ardesia-giorno': 'ardesia'
}

/** I temi chiari (per scegliere l'icona del pulsante) */
export const LIGHT_THEMES: ThemeId[] = ['ardesia-giorno', 'corallo', 'cielo', 'salvia', 'vinile']
export type ThemeId = (typeof THEMES)[number]

export interface StudioApi {
  getInfo(): Promise<AppInfo>
  /** Chiude l'applicazione (manutenzione) */
  quitApp(): Promise<void>
  /** Spegne il PC (Windows: shutdown /s /t 0) */
  shutdownPc(): Promise<{ ok: boolean; message?: string }>
  /** Numero di registrazioni salvate (fase 4-5: indice reale) */
  getRecordingCount(): Promise<number>
  /** Salva il tema scelto (es. pulsante Giorno/Notte) */
  setTheme(theme: ThemeId): Promise<void>
  youtube: YouTubeApi
}

export const IPC = {
  getInfo: 'app:get-info',
  quitApp: 'app:quit',
  shutdownPc: 'system:shutdown',
  recordingCount: 'library:count',
  setTheme: 'settings:set-theme',
  ytShow: 'yt:show',
  ytBounds: 'yt:bounds',
  ytHide: 'yt:hide',
  ytCommand: 'yt:command',
  ytGoBack: 'yt:go-back',
  /** preload YouTube → main */
  ytFromPage: 'yt:from-page',
  /** main → interfaccia */
  ytEvent: 'yt:event'
} as const
