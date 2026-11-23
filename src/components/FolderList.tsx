import type { ReactNode } from 'react'
import { Clock3, Disc3, Folder, FolderPlus, Star, Trash2 } from 'lucide-react'
import { viewKey, type View } from '../lib/filters'

interface Props {
  folders: string[]
  counts: { all: number; favorites: number; recent: number; trash: number; byFolder: Record<string, number> }
  view: View
  onSelect: (v: View) => void
  onNewFolder: () => void
}

/** Colonna sinistra: viste globali, cartelle, nuova cartella e (in fondo) eliminate */
export function FolderList({ folders, counts, view, onSelect, onNewFolder }: Props) {
  const active = viewKey(view)
  const item = (v: View, icon: ReactNode, label: string, count: number, extra = '') => {
    const isActive = viewKey(v) === active
    return (
      <button
        key={viewKey(v)}
        type="button"
        data-nav=""
        data-nav-compact=""
        data-autofocus={isActive ? '' : undefined}
        onClick={() => onSelect(v)}
        className={`flex min-h-[4.4rem] w-full items-center gap-4 rounded-[1.1rem] border-2 px-4 text-left text-[1.55rem] font-extrabold ${
          isActive ? 't-card2' : 'border-transparent'
        } ${extra}`}
      >
        <span className="shrink-0 [&>svg]:size-[2rem]">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className={`shrink-0 rounded-full px-3 text-[1.25rem] font-black ${isActive ? 'bg-white/25' : 't-btn-neutral'}`}>{count}</span>
      </button>
    )
  }

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-5 py-4">
      {item({ kind: 'all' }, <Disc3 />, 'Tutte le registrazioni', counts.all)}
      {item({ kind: 'favorites' }, <Star />, 'Preferite', counts.favorites)}
      {item({ kind: 'recent' }, <Clock3 />, 'Recenti', counts.recent)}
      <div className="t-muted mt-3 mb-1 px-4 text-[1.15rem] font-black tracking-wider uppercase">Cartelle</div>
      {folders.map((f) => item({ kind: 'folder', folder: f }, <Folder />, f, counts.byFolder[f] ?? 0))}
      <button
        type="button"
        data-nav=""
        data-nav-compact=""
        onClick={onNewFolder}
        className="t-accent-ink flex min-h-[4.2rem] w-full items-center gap-4 rounded-[1.1rem] border-2 border-dashed border-current/40 px-4 text-left text-[1.5rem] font-extrabold"
      >
        <FolderPlus className="size-[2rem]" /> Nuova cartella
      </button>
      <div className="flex-1" />
      <div className="t-header mt-3 border-t-2 pt-3">
        {item({ kind: 'trash' }, <Trash2 />, 'Registrazioni eliminate', counts.trash, 'opacity-70')}
      </div>
    </nav>
  )
}
