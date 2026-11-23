import { Check, Folder, Music2, Star } from 'lucide-react'
import type { Recording } from '../../electron/ipc-types'
import { dateTime, duration } from '../lib/text'

interface Props {
  recording: Recording
  /** Mostra la cartella (nelle viste globali) */
  showFolder: boolean
  /** Nelle eliminate: giorni rimasti */
  daysLeft?: number
  /** Modalità selezione: undefined = non attiva */
  selected?: boolean
  onOpen: () => void
}

/** Riga grande della lista: nome, cartella, data e ora, durata, ⭐ */
export function RecordingRow({ recording: r, showFolder, daysLeft, selected, onOpen }: Props) {
  return (
    <button
      type="button"
      data-nav=""
      data-nav-row=""
      onClick={onOpen}
      aria-pressed={selected}
      className={`flex min-h-[6rem] w-full items-center gap-5 rounded-[1.3rem] border-2 px-5 text-left ${selected ? 't-card2' : 't-surface'}`}
    >
      {selected !== undefined ? (
        <span
          className={`flex size-[3.6rem] shrink-0 items-center justify-center rounded-[0.9rem] border-[0.25rem] ${
            selected ? 'border-white bg-white text-[#2fa294]' : 'border-current opacity-60'
          }`}
        >
          {selected && <Check className="size-[2.2rem]" strokeWidth={4} />}
        </span>
      ) : (
        <span className={`flex size-[3.6rem] shrink-0 items-center justify-center rounded-full ${r.favorite ? 'bg-[#ffd166] text-[#7a5200]' : 't-btn-neutral'}`}>
          {r.favorite ? <Star className="size-[1.9rem] fill-current" /> : <Music2 className="size-[1.9rem]" />}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[1.7rem] leading-tight font-black">{r.title}</span>
        <span className={`flex items-center gap-3 truncate text-[1.25rem] font-bold ${selected ? 'opacity-85' : 't-muted'}`}>
          {daysLeft !== undefined ? (
            <>
              <span>da «{r.originalFolder ?? 'Generale'}»</span>·
              <span className={daysLeft <= 2 ? 'font-black text-rec' : ''}>
                {daysLeft === 0 ? 'Si cancella oggi' : daysLeft === 1 ? 'Si cancella domani' : `Si cancella tra ${daysLeft} giorni`}
              </span>
            </>
          ) : (
            <>
              {showFolder && (
                <>
                  <span className="flex items-center gap-1">
                    <Folder className="size-[1.3rem]" /> {r.folder}
                  </span>
                  ·
                </>
              )}
              <span>{dateTime(r.createdAt)}</span>
            </>
          )}
        </span>
      </span>
      <span className="shrink-0 text-[1.9rem] font-black tabular-nums">{duration(r.durationSec)}</span>
    </button>
  )
}
