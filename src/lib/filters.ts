import { DELETED_FOLDER, type Recording } from '../../electron/ipc-types'
import { normalize, songsCount } from './text'

export type View =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'recent' }
  | { kind: 'folder'; folder: string }
  | { kind: 'trash' }

export type DateFilter = 'all' | 'today' | 'week' | 'month' | 'year'
export type DurFilter = 'all' | 'short' | 'medium' | 'long'
export type Sort = 'date-desc' | 'date-asc' | 'dur-desc' | 'dur-asc' | 'name-asc' | 'name-desc'

export interface Filters {
  search: string
  date: DateFilter
  dur: DurFilter
  sort: Sort
}

export const DEFAULT_FILTERS: Filters = { search: '', date: 'all', dur: 'all', sort: 'date-desc' }

export const DATE_LABELS: Record<DateFilter, string> = {
  all: 'Tutte',
  today: 'Oggi',
  week: 'Ultima settimana',
  month: 'Ultimo mese',
  year: "Quest'anno"
}
export const DUR_LABELS: Record<DurFilter, string> = {
  all: 'Tutte',
  short: 'Corte (meno di 3 min)',
  medium: 'Medie (3–5 min)',
  long: 'Lunghe (più di 5 min)'
}
export const SORT_LABELS: Record<Sort, string> = {
  'date-desc': 'più recenti prima',
  'date-asc': 'più vecchie prima',
  'dur-desc': 'più lunghe prima',
  'dur-asc': 'più corte prima',
  'name-asc': 'nome A→Z',
  'name-desc': 'nome Z→A'
}

export const viewKey = (v: View) => (v.kind === 'folder' ? `f:${v.folder}` : v.kind)

const DAY = 86_400_000

/** Registrazioni della vista (prima dei filtri) */
export function inView(all: Recording[], view: View, now = Date.now()): Recording[] {
  switch (view.kind) {
    case 'all':
      return all.filter((r) => r.folder !== DELETED_FOLDER)
    case 'favorites':
      return all.filter((r) => r.folder !== DELETED_FOLDER && r.favorite)
    case 'recent':
      return all.filter((r) => r.folder !== DELETED_FOLDER && now - Date.parse(r.createdAt) <= 7 * DAY)
    case 'folder':
      return all.filter((r) => r.folder === view.folder)
    case 'trash':
      return all.filter((r) => r.folder === DELETED_FOLDER)
  }
}

function matchesDate(r: Recording, f: DateFilter, now: Date): boolean {
  if (f === 'all') return true
  const t = Date.parse(r.createdAt)
  if (f === 'today') return new Date(t).toDateString() === now.toDateString()
  if (f === 'week') return now.getTime() - t <= 7 * DAY
  if (f === 'month') return now.getTime() - t <= 31 * DAY
  return new Date(t).getFullYear() === now.getFullYear()
}

function matchesDur(r: Recording, f: DurFilter): boolean {
  if (f === 'all') return true
  if (f === 'short') return r.durationSec < 180
  if (f === 'medium') return r.durationSec >= 180 && r.durationSec <= 300
  return r.durationSec > 300
}

/** Applica ricerca, filtri (combinati) e ordinamento */
export function applyFilters(list: Recording[], f: Filters, now = new Date()): Recording[] {
  const q = normalize(f.search.trim())
  const out = list.filter(
    (r) => (!q || normalize(r.title).includes(q)) && matchesDate(r, f.date, now) && matchesDur(r, f.dur)
  )
  const byName = (a: Recording, b: Recording) => a.title.localeCompare(b.title, 'it', { sensitivity: 'base' })
  const byDate = (a: Recording, b: Recording) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
  out.sort((a, b) => {
    switch (f.sort) {
      case 'date-desc':
        return byDate(b, a)
      case 'date-asc':
        return byDate(a, b)
      case 'dur-desc':
        return b.durationSec - a.durationSec || byDate(b, a)
      case 'dur-asc':
        return a.durationSec - b.durationSec || byDate(b, a)
      case 'name-asc':
        return byName(a, b)
      case 'name-desc':
        return byName(b, a)
    }
  })
  return out
}

export const isDefault = (f: Filters) =>
  !f.search && f.date === 'all' && f.dur === 'all' && f.sort === DEFAULT_FILTERS.sort

/** "12 canzoni · ultimo mese · più lunghe prima" */
export function summary(count: number, f: Filters): string {
  const parts = [songsCount(count)]
  if (f.search) parts.push(`«${f.search}»`)
  if (f.date !== 'all') parts.push(DATE_LABELS[f.date].toLowerCase())
  if (f.dur !== 'all') parts.push(DUR_LABELS[f.dur].split(' (')[0].toLowerCase())
  parts.push(SORT_LABELS[f.sort])
  return parts.join(' · ')
}

/** Giorni rimasti prima della cancellazione definitiva */
export function daysLeft(r: Recording, retentionDays = 14, now = Date.now()): number {
  if (!r.deletedAt) return retentionDays
  const passed = (now - Date.parse(r.deletedAt)) / DAY
  return Math.max(0, Math.ceil(retentionDays - passed))
}

/** Filtri ricordati per ogni vista durante la sessione */
const remembered = new Map<string, Filters>()
export const rememberFilters = (v: View, f: Filters) => remembered.set(viewKey(v), f)
export const recallFilters = (v: View): Filters => remembered.get(viewKey(v)) ?? DEFAULT_FILTERS
