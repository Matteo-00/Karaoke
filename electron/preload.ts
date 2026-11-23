import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type StudioApi } from './ipc-types'

/** API sicura esposta all'interfaccia come window.studio */
const api: StudioApi = {
  getInfo: () => ipcRenderer.invoke(IPC.getInfo),
  quitApp: () => ipcRenderer.invoke(IPC.quitApp),
  shutdownPc: () => ipcRenderer.invoke(IPC.shutdownPc),
  getRecordingCount: () => ipcRenderer.invoke(IPC.recordingCount)
}

contextBridge.exposeInMainWorld('studio', api)
