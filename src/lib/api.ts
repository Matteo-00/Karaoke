import type { StudioApi } from '../../electron/ipc-types'

declare global {
  interface Window {
    studio?: StudioApi
  }
}

/**
 * Versione "finta" dell'API, usata solo quando l'interfaccia viene aperta
 * in un normale browser (anteprima di sviluppo, screenshot).
 */
const browserMock: StudioApi = {
  async getInfo() {
    return { appName: 'Studio Karaoke', version: '0.1.0', isDev: true, platform: 'linux', theme: 'ardesia', countdownSeconds: 5 }
  },
  async quitApp() {
    console.info('[anteprima] chiudi app')
  },
  async shutdownPc() {
    return { ok: false, message: 'Anteprima nel browser: il PC non viene spento' }
  },
  async setTheme() {},
  async mixerHint() {
    return 'USB Audio'
  },
  recorder: {
    async begin() {
      return 'anteprima'
    },
    async chunk() {},
    async finish() {},
    async orphans() {
      return []
    }
  },
  library: {
    async get() {
      return { recordings: [], folders: ['Generale'] }
    },
    async saveTemp() {
      throw new Error('Anteprima nel browser')
    },
    async discardTemp() {},
    async createFolder(name: string) {
      return name
    },
    async renameFolder(_a: string, b: string) {
      return b
    },
    async deleteFolder() {
      return 0
    },
    async rename() {},
    async move() {},
    async setFavorite() {},
    async remove() {},
    async restore() {},
    async readAudio() {
      return new ArrayBuffer(0)
    },
    onChanged() {
      return () => {}
    }
  },
  youtube: {
    async show() {},
    async setBounds() {},
    async hide() {
      return null
    },
    async command() {},
    async goBack() {
      return false
    },
    onEvent() {
      return () => {}
    }
  },
  async getRecordingCount() {
    const n = Number(new URLSearchParams(location.search).get('registrazioni') ?? 0)
    return Number.isFinite(n) ? n : 0
  }
}

export const studio: StudioApi = window.studio ?? browserMock
