import { Cable, Circle, Square, TriangleAlert } from 'lucide-react'
import { VuMeter } from './VuMeter'

export type RecStatus = 'ready' | 'countdown' | 'listening' | 'recording' | 'paused' | 'saving'

const STATUS: Record<RecStatus, { label: string; dot: string; text: string; pulse?: boolean }> = {
  ready: { label: 'Pronto', dot: 'bg-[#9aa5b8]', text: '' },
  countdown: { label: 'Si parte tra…', dot: 'bg-[#facc15]', text: 'text-[#d9a400]' },
  listening: { label: 'Solo ascolto', dot: 'bg-[#35a99c]', text: 't-accent-ink' },
  recording: { label: 'REGISTRAZIONE', dot: 'bg-rec', text: 'text-rec', pulse: true },
  paused: { label: 'In pausa', dot: 'bg-[#fb923c]', text: 'text-[#f08a2c]' },
  saving: { label: 'Salvataggio…', dot: 'bg-[#35a99c]', text: 't-accent-ink' }
}

const mmss = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  status: RecStatus
  seconds: number
  songTitle: string
  canRecord: boolean
  onRecord: () => void
  onStop: () => void
  analyser: AnalyserNode | null
  /** Stato dell'ingresso: mixer ok, altro microfono, niente */
  input: { ok: boolean; isMixer: boolean; label: string }
}

/** Barra inferiore "Registrazione": stato, tempo, canzone, Registra e STOP */
export function RecordingBar({ status, seconds, songTitle, canRecord, onRecord, onStop, analyser, input }: Props) {
  const st = STATUS[status]
  const recordingNow = status === 'recording' || status === 'paused'
  return (
    <footer className="t-header flex h-[7rem] shrink-0 items-center gap-6 border-t-2 px-[1.5rem]">
      {/* Stato */}
      <div className={`flex min-w-[16.5rem] items-center gap-4 text-[1.8rem] font-black ${st.text}`}>
        <span className={`size-[1.6rem] shrink-0 rounded-full ${st.dot} ${st.pulse ? 'anim-rec' : ''}`} />
        {st.label}
      </div>

      {/* Tempo registrato */}
      <div
        className={`min-w-[8.5rem] text-[2.6rem] font-black tabular-nums ${recordingNow ? '' : 't-muted'}`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {mmss(seconds)}
      </div>

      {/* Livello del microfono (sempre visibile) */}
      <div className="flex w-[13rem] shrink-0 flex-col gap-1">
        <VuMeter analyser={analyser} />
        <span className={`flex items-center gap-1 truncate text-[1.05rem] font-bold ${input.ok && input.isMixer ? 't-muted' : 'text-[#e8a100]'}`}>
          {!input.ok ? (
            <>
              <Cable className="size-[1.2rem] shrink-0" /> Mixer non collegato
            </>
          ) : input.isMixer ? (
            'Microfono del mixer'
          ) : (
            <>
              <TriangleAlert className="size-[1.2rem] shrink-0" /> Non è il mixer
            </>
          )}
        </span>
      </div>

      {/* Canzone */}
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="t-muted text-[1.2rem] font-bold">Canzone</span>
        <span className="truncate text-[1.6rem] font-extrabold">{songTitle || 'Scegli una canzone su YouTube'}</span>
      </div>

      {/* Azioni */}
      {!recordingNow ? (
        <button
          type="button"
          data-nav=""
          data-nav-compact=""
          disabled={!canRecord}
          onClick={onRecord}
          className="t-btn-danger flex h-[4.8rem] items-center gap-3 rounded-[1.3rem] border-2 px-7 text-[1.7rem] font-black"
        >
          <Circle className="size-[1.7rem] fill-current" />
          Registra
        </button>
      ) : null}
      <button
        type="button"
        data-nav=""
        data-nav-compact=""
        disabled={!recordingNow}
        onClick={onStop}
        className={`flex h-[4.8rem] items-center gap-3 rounded-[1.3rem] border-2 px-7 text-[1.7rem] font-black ${
          recordingNow ? 'border-transparent bg-rec text-white' : 't-btn-neutral'
        }`}
      >
        <Square className="size-[1.6rem] fill-current" />
        STOP
      </button>
    </footer>
  )
}
