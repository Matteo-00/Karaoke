import { Folder, FolderPlus } from 'lucide-react'
import { DEFAULT_FOLDER } from '../../electron/ipc-types'

interface Props {
  folders: string[]
  /** Numero di canzoni per cartella (facoltativo) */
  counts?: Record<string, number>
  /** Cartella da evidenziare come attuale (es. quando si sposta) */
  current?: string
  onPick: (folder: string) => void
  onNew: () => void
}

/**
 * Selettore di cartelle interno all'app (il dialog di Windows è inutilizzabile
 * col telecomando): griglia di riquadri grandi, "Generale" selezionata di default.
 */
export function FolderPicker({ folders, counts, current, onPick, onNew }: Props) {
  return (
    <div className="grid max-h-[28rem] w-full grid-cols-4 gap-5 overflow-y-auto p-5">
      {folders.map((f) => {
        const isCurrent = f === current
        return (
          <button
            key={f}
            type="button"
            data-nav=""
            data-autofocus={(current ? f !== current && f === DEFAULT_FOLDER : f === DEFAULT_FOLDER) ? '' : undefined}
            disabled={isCurrent}
            onClick={() => onPick(f)}
            className={`flex h-[10rem] flex-col items-center justify-center gap-2 rounded-[1.4rem] border-2 px-3 text-[1.6rem] font-extrabold ${
              f === DEFAULT_FOLDER ? 't-card2' : 't-surface'
            }`}
          >
            <Folder className="size-[3.2rem] shrink-0" strokeWidth={2} />
            <span className="line-clamp-2 leading-tight">{f}</span>
            {(counts || isCurrent) && (
              <span className="text-[1.2rem] font-bold opacity-70">
                {isCurrent ? 'È già qui' : `${counts?.[f] ?? 0} canzoni`}
              </span>
            )}
          </button>
        )
      })}
      <button
        type="button"
        data-nav=""
        onClick={onNew}
        className="t-surface flex h-[10rem] flex-col items-center justify-center gap-2 rounded-[1.4rem] border-2 border-dashed text-[1.6rem] font-extrabold"
      >
        <FolderPlus className="t-accent-ink size-[3.2rem]" strokeWidth={2} />
        Nuova cartella
      </button>
    </div>
  )
}
