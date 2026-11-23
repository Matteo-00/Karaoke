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
}

export const IPC = {
  getInfo: 'app:get-info',
  quitApp: 'app:quit',
  shutdownPc: 'system:shutdown',
  recordingCount: 'library:count',
  setTheme: 'settings:set-theme'
} as const
