/**
 * Archivio delle registrazioni.
 *
 * Su disco (cartella radice, di default Documenti\Studio Karaoke):
 *   Registrazioni\Generale\*.mp3
 *   Registrazioni\<cartella utente>\*.mp3
 *   Eliminate\*.mp3            ← registrazioni eliminate (recuperabili)
 *   .temp\<id>.webm + .json    ← registrazioni in corso / non ancora salvate
 *   library.json               ← indice (scritture atomiche: file temporaneo + rename)
 *
 * Le cartelle sono le sottocartelle reali di "Registrazioni". L'indice viene
 * riconciliato con il disco a ogni avvio.
 */
import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { appendFile, mkdir, readdir, readFile, rename, rm, rmdir, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { convertToMp3, readDuration } from './audio-convert'
import {
  DEFAULT_FOLDER,
  DELETED_FOLDER,
  type LibrarySnapshot,
  type Recording,
  type TempRecording
} from './ipc-types'

interface Index {
  version: 1
  recordings: Recording[]
}

interface TempMeta extends TempRecording {
  finished: boolean
}

export class Library {
  private index: Index = { version: 1, recordings: [] }
  /** Le operazioni sull'indice vengono eseguite una alla volta */
  private queue: Promise<unknown> = Promise.resolve()
  /** Registrazioni temporanee aperte in questa sessione (non sono "orfane") */
  private activeTemps = new Set<string>()

  constructor(
    private root: string,
    private opts: { bitrate: () => number; onChange: () => void; log: (...a: unknown[]) => void }
  ) {}

  // ------------------------------------------------------------ percorsi
  get recDir() {
    return join(this.root, 'Registrazioni')
  }
  get trashDir() {
    return join(this.root, 'Eliminate')
  }
  get tempDir() {
    return join(this.root, '.temp')
  }
  private get indexFile() {
    return join(this.root, 'library.json')
  }
  private folderDir(folder: string) {
    return folder === DELETED_FOLDER ? this.trashDir : join(this.recDir, folder)
  }
  filePath(r: Recording) {
    return join(this.folderDir(r.folder), r.fileName)
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.queue.then(fn, fn)
    this.queue = p.catch(() => undefined)
    return p
  }

  private async persist(): Promise<void> {
    const tmp = this.indexFile + '.tmp'
    await writeFile(tmp, JSON.stringify(this.index, null, 2), 'utf8')
    await rename(tmp, this.indexFile)
    this.opts.onChange()
  }

  // ------------------------------------------------------------ avvio
  async init(): Promise<void> {
    await mkdir(join(this.recDir, DEFAULT_FOLDER), { recursive: true })
    await mkdir(this.trashDir, { recursive: true })
    await mkdir(this.tempDir, { recursive: true })
    try {
      const raw = JSON.parse(await readFile(this.indexFile, 'utf8')) as Index
      if (Array.isArray(raw.recordings)) this.index = { version: 1, recordings: raw.recordings }
    } catch {
      /* prima volta o indice illeggibile: lo ricostruiamo dal disco */
    }
    await this.run(() => this.reconcile())
  }

  /** Allinea l'indice ai file presenti su disco */
  private async reconcile(): Promise<void> {
    const onDisk = new Map<string, { folder: string; file: string }>()
    for (const folder of await this.listFolderDirs()) {
      for (const file of await safeReaddir(join(this.recDir, folder))) {
        if (extname(file).toLowerCase() === '.mp3') onDisk.set(`${folder}/${file}`, { folder, file })
      }
    }
    for (const file of await safeReaddir(this.trashDir)) {
      if (extname(file).toLowerCase() === '.mp3') onDisk.set(`${DELETED_FOLDER}/${file}`, { folder: DELETED_FOLDER, file })
    }

    const before = this.index.recordings.length
    // Record il cui file non esiste più → rimossi
    this.index.recordings = this.index.recordings.filter((r) => onDisk.has(`${r.folder}/${r.fileName}`))
    const removed = before - this.index.recordings.length

    // File presenti su disco ma non nell'indice → aggiunti
    const known = new Set(this.index.recordings.map((r) => `${r.folder}/${r.fileName}`))
    let added = 0
    for (const [key, { folder, file }] of onDisk) {
      if (known.has(key)) continue
      const full = join(this.folderDir(folder), file)
      const st = await stat(full)
      this.index.recordings.push({
        id: randomUUID(),
        title: basename(file, extname(file)),
        fileName: file,
        folder,
        ...(folder === DELETED_FOLDER
          ? { originalFolder: DEFAULT_FOLDER, deletedAt: st.mtime.toISOString() }
          : {}),
        createdAt: st.mtime.toISOString(),
        durationSec: await readDuration(full),
        sizeBytes: st.size,
        favorite: false
      })
      added++
    }
    if (added || removed || !existsSync(this.indexFile)) {
      this.opts.log(`archivio riconciliato: +${added} −${removed}`)
      await this.persist()
    }
  }

  private async listFolderDirs(): Promise<string[]> {
    const entries = await readdir(this.recDir, { withFileTypes: true }).catch(() => [])
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  }

  // ------------------------------------------------------------ lettura
  async snapshot(): Promise<LibrarySnapshot> {
    const folders = (await this.listFolderDirs())
      .filter((f) => f !== DEFAULT_FOLDER)
      .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
    return { recordings: [...this.index.recordings], folders: [DEFAULT_FOLDER, ...folders] }
  }

  count(): number {
    return this.index.recordings.filter((r) => r.folder !== DELETED_FOLDER).length
  }

  private find(id: string): Recording {
    const r = this.index.recordings.find((x) => x.id === id)
    if (!r) throw new Error('Registrazione non trovata')
    return r
  }

  async readAudio(id: string): Promise<Buffer> {
    return readFile(this.filePath(this.find(id)))
  }

  // ------------------------------------------------------------ registrazioni temporanee
  async beginTemp(meta: { title: string; videoId?: string; videoTitle?: string }): Promise<string> {
    const id = `${Date.now()}-${randomUUID().slice(0, 8)}`
    const m: TempMeta = {
      id,
      title: meta.title,
      videoId: meta.videoId,
      videoTitle: meta.videoTitle,
      startedAt: new Date().toISOString(),
      durationSec: 0,
      sizeBytes: 0,
      finished: false
    }
    await writeFile(join(this.tempDir, `${id}.webm`), Buffer.alloc(0))
    await writeFile(join(this.tempDir, `${id}.json`), JSON.stringify(m))
    this.activeTemps.add(id)
    return id
  }

  async appendTemp(id: string, data: ArrayBuffer): Promise<void> {
    // Scrittura progressiva: un crash non fa perdere quanto già registrato
    await appendFile(join(this.tempDir, `${safeId(id)}.webm`), Buffer.from(data))
  }

  async finishTemp(id: string, durationSec: number): Promise<void> {
    const metaFile = join(this.tempDir, `${safeId(id)}.json`)
    const m = JSON.parse(await readFile(metaFile, 'utf8')) as TempMeta
    m.durationSec = Math.round(durationSec)
    m.finished = true
    await writeFile(metaFile, JSON.stringify(m))
  }

  /** Temporanei rimasti da una sessione precedente */
  async orphans(): Promise<TempRecording[]> {
    const list: TempRecording[] = []
    for (const file of await safeReaddir(this.tempDir)) {
      if (!file.endsWith('.json')) continue
      const id = basename(file, '.json')
      if (this.activeTemps.has(id)) continue
      try {
        const m = JSON.parse(await readFile(join(this.tempDir, file), 'utf8')) as TempMeta
        const st = await stat(join(this.tempDir, `${id}.webm`))
        const size = st.size
        if (size < 2048) {
          // Niente audio utile: puliamo
          await this.deleteTemp(id)
          continue
        }
        // Se l'app si è chiusa durante la registrazione la durata non è nota:
        // la stimiamo dall'ultimo pezzo scritto su disco
        const durationSec = m.durationSec || Math.max(1, Math.round((st.mtimeMs - Date.parse(m.startedAt)) / 1000))
        list.push({ ...m, id, durationSec, sizeBytes: size })
      } catch {
        await this.deleteTemp(id)
      }
    }
    return list
  }

  private async deleteTemp(id: string): Promise<void> {
    this.activeTemps.delete(id)
    await rm(join(this.tempDir, `${id}.webm`), { force: true })
    await rm(join(this.tempDir, `${id}.json`), { force: true })
  }

  private async tempMeta(id: string): Promise<TempMeta> {
    return JSON.parse(await readFile(join(this.tempDir, `${safeId(id)}.json`), 'utf8')) as TempMeta
  }

  /** Converte il temporaneo in MP3 nella cartella indicata e lo aggiunge all'indice */
  saveTemp(tempId: string, title: string, folder: string): Promise<Recording> {
    return this.run(async () => {
      const id = safeId(tempId)
      const meta = await this.tempMeta(id)
      const realFolder = folder === DELETED_FOLDER || (await this.folderExists(folder)) ? folder : DEFAULT_FOLDER
      const dir = this.folderDir(realFolder)
      await mkdir(dir, { recursive: true })
      const cleanTitle = title.trim() || 'Registrazione'
      const fileName = await uniqueFileName(dir, sanitizeFileName(cleanTitle), '.mp3')
      const out = join(dir, fileName)
      await convertToMp3(join(this.tempDir, `${id}.webm`), out, { bitrate: this.opts.bitrate(), title: cleanTitle })
      const st = await stat(out)
      const durationSec = (await readDuration(out)) || meta.durationSec
      const now = new Date().toISOString()
      const rec: Recording = {
        id: randomUUID(),
        title: cleanTitle,
        fileName,
        folder: realFolder,
        createdAt: meta.startedAt || now,
        durationSec,
        sizeBytes: st.size,
        favorite: false,
        videoId: meta.videoId,
        videoTitle: meta.videoTitle,
        ...(realFolder === DELETED_FOLDER ? { deletedAt: now, originalFolder: DEFAULT_FOLDER } : {})
      }
      this.index.recordings.push(rec)
      await this.persist()
      await this.deleteTemp(id)
      this.opts.log(`salvata «${cleanTitle}» in ${realFolder} (${durationSec}s)`)
      return rec
    })
  }

  /** "Scarta": la registrazione finisce nelle eliminate, così si può recuperare */
  async discardTemp(tempId: string): Promise<void> {
    const meta = await this.tempMeta(tempId)
    await this.saveTemp(tempId, meta.title || 'Registrazione scartata', DELETED_FOLDER)
  }

  // ------------------------------------------------------------ cartelle
  private async folderExists(folder: string): Promise<boolean> {
    return (await this.listFolderDirs()).includes(folder)
  }

  createFolder(name: string): Promise<string> {
    return this.run(async () => {
      const clean = sanitizeFolderName(name)
      const existing = (await this.listFolderDirs()).find((f) => f.toLowerCase() === clean.toLowerCase())
      if (existing) return existing
      await mkdir(join(this.recDir, clean), { recursive: true })
      this.opts.onChange()
      return clean
    })
  }

  renameFolder(oldName: string, newName: string): Promise<string> {
    return this.run(async () => {
      if (oldName === DEFAULT_FOLDER) throw new Error('La cartella Generale non si può rinominare')
      const clean = sanitizeFolderName(newName)
      if (clean === oldName) return clean
      const folders = await this.listFolderDirs()
      if (folders.some((f) => f.toLowerCase() === clean.toLowerCase() && f !== oldName)) {
        throw new Error('Esiste già una cartella con questo nome')
      }
      await rename(join(this.recDir, oldName), join(this.recDir, clean))
      for (const r of this.index.recordings) {
        if (r.folder === oldName) r.folder = clean
        if (r.originalFolder === oldName) r.originalFolder = clean
      }
      await this.persist()
      return clean
    })
  }

  deleteFolder(name: string): Promise<number> {
    return this.run(async () => {
      if (name === DEFAULT_FOLDER) throw new Error('La cartella Generale non si può eliminare')
      const inside = this.index.recordings.filter((r) => r.folder === name)
      for (const r of inside) await this.moveToTrash(r)
      // Eventuali file non audio rimasti vengono lasciati: in quel caso la cartella resta
      await rmdir(join(this.recDir, name)).catch(async () => {
        const left = await safeReaddir(join(this.recDir, name))
        if (left.length === 0) await rm(join(this.recDir, name), { recursive: true, force: true })
      })
      await this.persist()
      return inside.length
    })
  }

  // ------------------------------------------------------------ azioni sulle registrazioni
  rename(id: string, title: string): Promise<void> {
    return this.run(async () => {
      const r = this.find(id)
      const clean = title.trim() || r.title
      const dir = this.folderDir(r.folder)
      const fileName = await uniqueFileName(dir, sanitizeFileName(clean), '.mp3', r.fileName)
      if (fileName !== r.fileName) await rename(join(dir, r.fileName), join(dir, fileName))
      r.title = clean
      r.fileName = fileName
      await this.persist()
    })
  }

  move(id: string, folder: string): Promise<void> {
    return this.run(async () => {
      const r = this.find(id)
      if (r.folder === folder) return
      if (!(await this.folderExists(folder))) throw new Error('Cartella non trovata')
      await this.moveFile(r, folder)
      await this.persist()
    })
  }

  setFavorite(id: string, favorite: boolean): Promise<void> {
    return this.run(async () => {
      this.find(id).favorite = favorite
      await this.persist()
    })
  }

  remove(id: string): Promise<void> {
    return this.run(async () => {
      await this.moveToTrash(this.find(id))
      await this.persist()
    })
  }

  restore(id: string): Promise<void> {
    return this.run(async () => {
      const r = this.find(id)
      if (r.folder !== DELETED_FOLDER) return
      const target = r.originalFolder && (await this.folderExists(r.originalFolder)) ? r.originalFolder : DEFAULT_FOLDER
      await this.moveFile(r, target)
      delete r.deletedAt
      delete r.originalFolder
      await this.persist()
    })
  }

  private async moveToTrash(r: Recording): Promise<void> {
    if (r.folder === DELETED_FOLDER) return
    const from = r.folder
    await this.moveFile(r, DELETED_FOLDER)
    r.originalFolder = from
    r.deletedAt = new Date().toISOString()
  }

  /** Sposta il file (se il nome è già usato aggiunge " (2)", " (3)"…) */
  private async moveFile(r: Recording, folder: string): Promise<void> {
    const fromPath = this.filePath(r)
    const dir = this.folderDir(folder)
    await mkdir(dir, { recursive: true })
    const base = basename(r.fileName, extname(r.fileName))
    const fileName = await uniqueFileName(dir, base, extname(r.fileName) || '.mp3')
    await moveAcross(fromPath, join(dir, fileName))
    r.folder = folder
    r.fileName = fileName
  }
}

// ======================================================= utilità

function safeId(id: string): string {
  if (!/^[\w-]+$/.test(id)) throw new Error('id non valido')
  return id
}

async function safeReaddir(dir: string): Promise<string[]> {
  return readdir(dir).catch(() => [])
}

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i

/** Nome file valido per Windows */
export function sanitizeFileName(name: string): string {
  let s = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
  if (s.length > 120) s = s.slice(0, 120).trim()
  if (!s) s = 'Registrazione'
  if (RESERVED.test(s)) s += '_'
  return s
}

function sanitizeFolderName(name: string): string {
  const s = sanitizeFileName(name).slice(0, 60).trim()
  if (s === DELETED_FOLDER || s.startsWith('.')) return 'Cartella'
  return s
}

/** "Nome.mp3", oppure "Nome (2).mp3", "Nome (3).mp3"… se esiste già */
async function uniqueFileName(dir: string, base: string, ext: string, allowExisting?: string): Promise<string> {
  let candidate = `${base}${ext}`
  let n = 2
  while (existsSync(join(dir, candidate)) && candidate !== allowExisting) {
    candidate = `${base} (${n})${ext}`
    n++
  }
  return candidate
}

/** rename, con ripiego copia+cancella se i percorsi sono su dischi diversi */
async function moveAcross(from: string, to: string): Promise<void> {
  try {
    await rename(from, to)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err
    await writeFile(to, await readFile(from))
    await unlink(from)
  }
}

export function defaultRoot(): string {
  return join(app.getPath('documents'), 'Studio Karaoke')
}
