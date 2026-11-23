import Store from 'electron-store'
import type { StudioSettings } from './ipc-types'

/** Impostazioni persistenti (impostazioni.json nella cartella dell'app) */
export type Settings = StudioSettings

export const SETTINGS_DEFAULTS: Settings = {
  appName: 'Studio Karaoke',
  autoStart: true,
  mixerLabelHint: 'USB Audio',
  voiceMicLabel: '',
  theme: 'ardesia',
  youtubeUrl: 'https://www.youtube.com',
  youtubeZoom: 1.35,
  countdownSeconds: 5,
  beep: false,
  dataRoot: '',
  mp3Bitrate: 192,
  trashDays: 14,
  voiceKey: '',
  voiceAuto: true
}

export const settings = new Store<Settings>({ name: 'impostazioni', defaults: SETTINGS_DEFAULTS })
