import Store from 'electron-store'
import type { ThemeId } from './ipc-types'

/** Impostazioni persistenti (verranno estese nella fase 7) */
export interface Settings {
  appName: string
  /** Avvio automatico all'accensione di Windows */
  autoStart: boolean
  /** Etichetta (parziale) del dispositivo audio del mixer */
  mixerLabelHint: string
  /** Tema grafico */
  theme: ThemeId
  /** Pagina iniziale di YouTube */
  youtubeUrl: string
  /** Zoom di YouTube per renderlo leggibile dalla TV (1 = 100%) */
  youtubeZoom: number
  /** Secondi del conto alla rovescia */
  countdownSeconds: number
}

const defaults: Settings = {
  appName: 'Studio Karaoke',
  autoStart: true,
  mixerLabelHint: 'USB Audio',
  theme: 'ardesia',
  youtubeUrl: 'https://www.youtube.com',
  youtubeZoom: 1.35,
  countdownSeconds: 5
}

export const settings = new Store<Settings>({ name: 'impostazioni', defaults })
