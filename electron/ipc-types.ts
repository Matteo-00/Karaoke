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
  /** Bip a ogni numero del conto alla rovescia */
  beep: boolean
  /** Giorni di conservazione delle registrazioni eliminate */
  trashDays: number
}

/** Tutte le impostazioni (modificabili dalla schermata nascosta) */
export interface StudioSettings {
  appName: string
  autoStart: boolean
  /** Nome (anche parziale) del dispositivo di ingresso usato per registrare */
  mixerLabelHint: string
  /** Microfono per la ricerca vocale (fase 8) */
  voiceMicLabel: string
  theme: ThemeId
  youtubeUrl: string
  /** 1 = 100% */
  youtubeZoom: number
  countdownSeconds: number
  beep: boolean
  /** Vuota = Documenti\\Studio Karaoke */
  dataRoot: string
  mp3Bitrate: number
  trashDays: number
  /** Tasto del telecomando che avvia la ricerca vocale (vuoto = tasti standard) */
  voiceKey: string
  /** Avvia la ricerca da sola quando si parla nel microfono del telecomando */
  voiceAuto: boolean
}

export interface SettingsApi {
  get(): Promise<StudioSettings & { version: string; dataRootResolved: string }>
  /** Salva alcune impostazioni e restituisce quelle aggiornate */
  set(patch: Partial<StudioSettings>): Promise<StudioSettings>
  /** Apre la cartella dei dati in Esplora risorse */
  openDataFolder(): Promise<void>
  /** Dialog di Windows per scegliere la cartella dei dati */
  chooseDataFolder(): Promise<string | null>
  /** Riavvia l'app (serve dopo aver cambiato la cartella dei dati) */
  restart(): Promise<void>
  /** Ultime righe del registro */
  logs(): Promise<string[]>
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
  | { type: 'key'; key: 'back' | 'home' | 'stop' | 'voice' }
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
  /** Cerca su YouTube (la ricerca compare nella barra di YouTube) */
  search(text: string): Promise<void>
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
  recorder: RecorderApi
  library: LibraryApi
  share: ShareApi
  settings: SettingsApi
  voice: VoiceApi
  /** Etichetta (parziale) del dispositivo audio del mixer */
  mixerHint(): Promise<string>
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
  ytEvent: 'yt:event',
  mixerHint: 'settings:mixer-hint',
  recBegin: 'rec:begin',
  recChunk: 'rec:chunk',
  recFinish: 'rec:finish',
  recOrphans: 'rec:orphans',
  libGet: 'lib:get',
  libSaveTemp: 'lib:save-temp',
  libDiscardTemp: 'lib:discard-temp',
  libCreateFolder: 'lib:create-folder',
  libRenameFolder: 'lib:rename-folder',
  libDeleteFolder: 'lib:delete-folder',
  libRename: 'lib:rename',
  libMove: 'lib:move',
  libFavorite: 'lib:favorite',
  libRemove: 'lib:remove',
  libRestore: 'lib:restore',
  libReadAudio: 'lib:read-audio',
  libChanged: 'lib:changed',
  shareStartPhone: 'share:start-phone',
  shareStopPhone: 'share:stop-phone',
  shareDownloaded: 'share:downloaded',
  usbList: 'share:usb-list',
  usbCopy: 'share:usb-copy',
  libPurge: 'lib:purge',
  libEmptyTrash: 'lib:empty-trash',
  setGet: 'settings:get',
  setSet: 'settings:set',
  setOpenFolder: 'settings:open-folder',
  setChooseFolder: 'settings:choose-folder',
  setRestart: 'settings:restart',
  setLogs: 'settings:logs',
  voiceTranscribe: 'voice:transcribe',
  voiceStatus: 'voice:status',
  voiceStatusEvent: 'voice:status-event',
  ytSearch: 'yt:search'
} as const

// ======================================================= registrazioni

/** Nome interno della "cartella" delle registrazioni eliminate */
export const DELETED_FOLDER = '__deleted__'
/** Cartella predefinita, non eliminabile */
export const DEFAULT_FOLDER = 'Generale'

/** Un record dell'indice library.json */
export interface Recording {
  id: string
  /** Nome mostrato */
  title: string
  fileName: string
  /** "Generale" | nome cartella utente | "__deleted__" */
  folder: string
  originalFolder?: string
  /** ISO */
  createdAt: string
  durationSec: number
  sizeBytes: number
  favorite: boolean
  /** ISO, presente se è nelle registrazioni eliminate */
  deletedAt?: string
  videoId?: string
  videoTitle?: string
}

export interface LibrarySnapshot {
  recordings: Recording[]
  /** Cartelle reali: "Generale" per prima, poi quelle dell'utente in ordine alfabetico */
  folders: string[]
}

/** Registrazione appena fatta (o rimasta da un crash), non ancora salvata */
export interface TempRecording {
  id: string
  title: string
  videoId?: string
  videoTitle?: string
  startedAt: string
  durationSec: number
  sizeBytes: number
}

export interface RecorderApi {
  /** Crea il file temporaneo e restituisce il suo id */
  begin(meta: { title: string; videoId?: string; videoTitle?: string }): Promise<string>
  /** Aggiunge un pezzo (1 secondo circa) al file temporaneo */
  chunk(id: string, data: ArrayBuffer): Promise<void>
  /** Registrazione finita: annota la durata */
  finish(id: string, durationSec: number): Promise<void>
  /** Registrazioni temporanee rimaste da una sessione precedente (crash) */
  orphans(): Promise<TempRecording[]>
}

export interface LibraryApi {
  get(): Promise<LibrarySnapshot>
  /** Converte in MP3 e salva nella cartella scelta */
  saveTemp(args: { tempId: string; title: string; folder: string }): Promise<Recording>
  /** Scarta: finisce comunque nelle registrazioni eliminate (14 giorni) */
  discardTemp(tempId: string): Promise<void>
  createFolder(name: string): Promise<string>
  renameFolder(oldName: string, newName: string): Promise<string>
  /** Elimina la cartella: le sue registrazioni vanno in quelle eliminate. Restituisce quante erano */
  deleteFolder(name: string): Promise<number>
  rename(id: string, title: string): Promise<void>
  move(id: string, folder: string): Promise<void>
  setFavorite(id: string, favorite: boolean): Promise<void>
  /** Sposta nelle registrazioni eliminate */
  remove(id: string): Promise<void>
  /** Riporta nella cartella originale (Annulla / Ripristina) */
  restore(id: string): Promise<void>
  /** Cancella per sempre una registrazione eliminata */
  purge(id: string): Promise<void>
  /** Svuota le registrazioni eliminate; restituisce quante erano */
  emptyTrash(): Promise<number>
  /** Contenuto del file MP3, per il player */
  readAudio(id: string): Promise<ArrayBuffer>
  /** Avvisa quando l'archivio cambia */
  onChanged(cb: () => void): () => void
}

// ======================================================= condivisione

export interface PhoneShare {
  /** Indirizzo da aprire sul telefono */
  url: string
  /** QR code (immagine data:) con l'indirizzo */
  qr: string
  expiresAt: string
}

export interface UsbDrive {
  /** Percorso della chiavetta (es. "E:\\") */
  path: string
  label: string
  freeBytes: number
}

export interface ShareApi {
  /** Avvia la condivisione sul telefono (Wi‑Fi di casa) */
  startPhone(ids: string[]): Promise<PhoneShare>
  stopPhone(): Promise<void>
  /** Avvisa quando il telefono ha scaricato una canzone */
  onDownloaded(cb: (id: string) => void): () => void
  listUsb(): Promise<UsbDrive[]>
  /** Copia sulla chiavetta; restituisce quante canzoni */
  copyToUsb(ids: string[], drivePath: string): Promise<number>
}

// ======================================================= voce

export type VoiceStatus =
  | { state: 'idle' }
  | { state: 'loading'; progress: number }
  | { state: 'ready' }
  | { state: 'error'; message: string }

export interface VoiceApi {
  /** Trascrive audio mono a 16 kHz (italiano) */
  transcribe(samples: Float32Array): Promise<string>
  status(): Promise<VoiceStatus>
  onStatus(cb: (s: VoiceStatus) => void): () => void
}
