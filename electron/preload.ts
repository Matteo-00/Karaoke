import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type StudioApi, type YtEvent } from './ipc-types'

/** API sicura esposta all'interfaccia come window.studio */
const api: StudioApi = {
  getInfo: () => ipcRenderer.invoke(IPC.getInfo),
  quitApp: () => ipcRenderer.invoke(IPC.quitApp),
  shutdownPc: () => ipcRenderer.invoke(IPC.shutdownPc),
  getRecordingCount: () => ipcRenderer.invoke(IPC.recordingCount),
  setTheme: (theme) => ipcRenderer.invoke(IPC.setTheme, theme),
  youtube: {
    show: (bounds) => ipcRenderer.invoke(IPC.ytShow, bounds),
    setBounds: (bounds) => ipcRenderer.invoke(IPC.ytBounds, bounds),
    hide: (snapshot) => ipcRenderer.invoke(IPC.ytHide, snapshot),
    command: (cmd) => ipcRenderer.invoke(IPC.ytCommand, cmd),
    goBack: () => ipcRenderer.invoke(IPC.ytGoBack),
    onEvent: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, ev: YtEvent) => cb(ev)
      ipcRenderer.on(IPC.ytEvent, listener)
      return () => ipcRenderer.removeListener(IPC.ytEvent, listener)
    }
  }
}

contextBridge.exposeInMainWorld('studio', api)
