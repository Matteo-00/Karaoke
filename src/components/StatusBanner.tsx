import { Cable, Gamepad2 } from 'lucide-react'

/**
 * Banner in basso: avviso giallo se il mixer non è collegato,
 * altrimenti un piccolo aiuto su come usare il telecomando.
 */
export function StatusBanner({ mixerConnected }: { mixerConnected: boolean | null }) {
  if (mixerConnected === false) {
    return (
      <div
        role="alert"
        className="anim-banner anim-fade flex items-center gap-5 rounded-[1.5rem] border-2 border-warn bg-[#3d3207]/90 px-8 py-4 text-[1.75rem] font-extrabold text-[#fde68a]"
      >
        <Cable className="size-[2.6rem] shrink-0 text-warn" strokeWidth={2.4} />
        <span>
          Il mixer non è collegato: <span className="text-white">controlla il cavo USB</span>
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-4 text-[1.5rem] font-bold text-white/55">
      <Gamepad2 className="size-[2rem]" />
      <span>
        Usa le <b className="text-white/80">frecce</b> del telecomando e premi <b className="text-white/80">OK</b>
      </span>
    </div>
  )
}
