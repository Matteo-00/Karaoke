import { Cable, Gamepad2, Volume2 } from 'lucide-react'

/**
 * Banner in basso: avviso giallo se il mixer non è collegato,
 * altrimenti un piccolo aiuto su come usare il telecomando.
 */
export function StatusBanner({ mixerConnected, outputIsMixer }: { mixerConnected: boolean | null; outputIsMixer?: boolean | null }) {
  if (mixerConnected === false) {
    return (
      <div
        role="alert"
        className="t-warn anim-fade flex items-center gap-5 rounded-[1.5rem] border-2 px-8 py-4 text-[1.75rem] font-extrabold"
      >
        <Cable className="size-[2.6rem] shrink-0" strokeWidth={2.4} />
        <span>
          Il mixer non è collegato: <span className="t-warn-strong">controlla il cavo USB</span>
        </span>
      </div>
    )
  }
  if (mixerConnected && outputIsMixer === false) {
    return (
      <div role="alert" className="t-warn anim-fade flex items-center gap-5 rounded-[1.5rem] border-2 px-8 py-4 text-[1.6rem] font-extrabold">
        <Volume2 className="size-[2.4rem] shrink-0" strokeWidth={2.4} />
        <span>
          Il suono non va al mixer: <span className="t-warn-strong">controlla l'uscita audio di Windows</span>
        </span>
      </div>
    )
  }
  return (
    <div className="t-muted flex items-center gap-4 text-[1.5rem] font-bold">
      <Gamepad2 className="size-[2rem]" />
      <span>
        Usa le <b style={{ color: 'var(--text)' }}>frecce</b> del telecomando e premi <b style={{ color: 'var(--text)' }}>OK</b>
      </span>
    </div>
  )
}
