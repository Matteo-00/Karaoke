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
}

export interface StudioApi {
  getInfo(): Promise<AppInfo>
  /** Chiude l'applicazione (manutenzione) */
  quitApp(): Promise<void>
  /** Spegne il PC (Windows: shutdown /s /t 0) */
  shutdownPc(): Promise<{ ok: boolean; message?: string }>
  /** Numero di registrazioni salvate (fase 4-5: indice reale) */
  getRecordingCount(): Promise<number>
}

export const IPC = {
  getInfo: 'app:get-info',
  quitApp: 'app:quit',
  shutdownPc: 'system:shutdown',
  recordingCount: 'library:count'
} as const
