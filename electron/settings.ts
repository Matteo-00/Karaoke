import Store from 'electron-store'

/** Impostazioni persistenti (verranno estese nella fase 7) */
export interface Settings {
  appName: string
  /** Avvio automatico all'accensione di Windows */
  autoStart: boolean
  /** Etichetta (parziale) del dispositivo audio del mixer */
  mixerLabelHint: string
}

const defaults: Settings = {
  appName: 'Studio Karaoke',
  autoStart: true,
  mixerLabelHint: 'USB Audio'
}

export const settings = new Store<Settings>({ name: 'impostazioni', defaults })
