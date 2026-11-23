import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type StudioApi, type VoiceStatus, type YtEvent } from './ipc-types'

/** API sicura esposta all'interfaccia come window.studio */
const api: StudioApi = {
  getInfo: () => ipcRenderer.invoke(IPC.getInfo),
  quitApp: () => ipcRenderer.invoke(IPC.quitApp),
  shutdownPc: () => ipcRenderer.invoke(IPC.shutdownPc),
  getRecordingCount: () => ipcRenderer.invoke(IPC.recordingCount),
  setTheme: (theme) => ipcRenderer.invoke(IPC.setTheme, theme),
  mixerHint: () => ipcRenderer.invoke(IPC.mixerHint),
  recorder: {
    begin: (meta) => ipcRenderer.invoke(IPC.recBegin, meta),
    chunk: (id, data) => ipcRenderer.invoke(IPC.recChunk, id, data),
    finish: (id, sec) => ipcRenderer.invoke(IPC.recFinish, id, sec),
    orphans: () => ipcRenderer.invoke(IPC.recOrphans)
  },
  library: {
    get: () => ipcRenderer.invoke(IPC.libGet),
    saveTemp: (a) => ipcRenderer.invoke(IPC.libSaveTemp, a),
    discardTemp: (id) => ipcRenderer.invoke(IPC.libDiscardTemp, id),
    createFolder: (name) => ipcRenderer.invoke(IPC.libCreateFolder, name),
    renameFolder: (a, b) => ipcRenderer.invoke(IPC.libRenameFolder, a, b),
    deleteFolder: (name) => ipcRenderer.invoke(IPC.libDeleteFolder, name),
    rename: (id, title) => ipcRenderer.invoke(IPC.libRename, id, title),
    move: (id, folder) => ipcRenderer.invoke(IPC.libMove, id, folder),
    setFavorite: (id, fav) => ipcRenderer.invoke(IPC.libFavorite, id, fav),
    remove: (id) => ipcRenderer.invoke(IPC.libRemove, id),
    restore: (id) => ipcRenderer.invoke(IPC.libRestore, id),
    purge: (id) => ipcRenderer.invoke(IPC.libPurge, id),
    emptyTrash: () => ipcRenderer.invoke(IPC.libEmptyTrash),
    readAudio: (id) => ipcRenderer.invoke(IPC.libReadAudio, id),
    onChanged: (cb) => {
      const listener = () => cb()
      ipcRenderer.on(IPC.libChanged, listener)
      return () => ipcRenderer.removeListener(IPC.libChanged, listener)
    }
  },
  voice: {
    transcribe: (samples) => ipcRenderer.invoke(IPC.voiceTranscribe, samples),
    status: () => ipcRenderer.invoke(IPC.voiceStatus),
    onStatus: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, s: VoiceStatus) => cb(s)
      ipcRenderer.on(IPC.voiceStatusEvent, listener)
      return () => ipcRenderer.removeListener(IPC.voiceStatusEvent, listener)
    }
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.setGet),
    set: (patch) => ipcRenderer.invoke(IPC.setSet, patch),
    openDataFolder: () => ipcRenderer.invoke(IPC.setOpenFolder),
    chooseDataFolder: () => ipcRenderer.invoke(IPC.setChooseFolder),
    restart: () => ipcRenderer.invoke(IPC.setRestart),
    logs: () => ipcRenderer.invoke(IPC.setLogs)
  },
  share: {
    startPhone: (ids) => ipcRenderer.invoke(IPC.shareStartPhone, ids),
    stopPhone: () => ipcRenderer.invoke(IPC.shareStopPhone),
    onDownloaded: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, id: string) => cb(id)
      ipcRenderer.on(IPC.shareDownloaded, listener)
      return () => ipcRenderer.removeListener(IPC.shareDownloaded, listener)
    },
    listUsb: () => ipcRenderer.invoke(IPC.usbList),
    copyToUsb: (ids, drive) => ipcRenderer.invoke(IPC.usbCopy, ids, drive)
  },
  youtube: {
    show: (bounds) => ipcRenderer.invoke(IPC.ytShow, bounds),
    setBounds: (bounds) => ipcRenderer.invoke(IPC.ytBounds, bounds),
    hide: (snapshot) => ipcRenderer.invoke(IPC.ytHide, snapshot),
    command: (cmd) => ipcRenderer.invoke(IPC.ytCommand, cmd),
    goBack: () => ipcRenderer.invoke(IPC.ytGoBack),
    search: (text) => ipcRenderer.invoke(IPC.ytSearch, text),
    onEvent: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, ev: YtEvent) => cb(ev)
      ipcRenderer.on(IPC.ytEvent, listener)
      return () => ipcRenderer.removeListener(IPC.ytEvent, listener)
    }
  }
}

contextBridge.exposeInMainWorld('studio', api)
