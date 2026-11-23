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
}

const defaults: Settings = {
  appName: 'Studio Karaoke',
  autoStart: true,
  mixerLabelHint: 'USB Audio',
  theme: 'palco'
}

export const settings = new Store<Settings>({ name: 'impostazioni', defaults })
