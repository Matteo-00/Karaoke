import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type StudioApi } from './ipc-types'

/** API sicura esposta all'interfaccia come window.studio */
const api: StudioApi = {
  getInfo: () => ipcRenderer.invoke(IPC.getInfo),
  quitApp: () => ipcRenderer.invoke(IPC.quitApp),
  shutdownPc: () => ipcRenderer.invoke(IPC.shutdownPc),
  getRecordingCount: () => ipcRenderer.invoke(IPC.recordingCount),
  setTheme: (theme) => ipcRenderer.invoke(IPC.setTheme, theme)
}

contextBridge.exposeInMainWorld('studio', api)
