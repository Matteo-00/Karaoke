import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'

const HOLD_MS = 3000

/**
 * Logo in alto a sinistra: microfono + nome dell'app.
 * Tenendo premuto 3 secondi (OK del telecomando o air mouse) apre le
 * impostazioni nascoste; un cerchio si riempie mentre si tiene premuto.
 */
export function AppLogo({ name, compact = false, onLongPress }: { name: string; compact?: boolean; onLongPress?: () => void }) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const keyDown = useRef(false)

  const start = () => {
    if (!onLongPress || timer.current) return
    setHolding(true)
    timer.current = window.setTimeout(() => {
      timer.current = undefined
      setHolding(false)
      onLongPress()
    }, HOLD_MS)
  }
  const cancel = () => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    keyDown.current = false
    setHolding(false)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const icon = (
    <div className={`relative flex items-center justify-center ${compact ? 'size-[3.2rem]' : 'size-[4.5rem]'}`}>
      <div className="t-logo absolute inset-0 rounded-full" />
      <Mic className={`relative ${compact ? 'size-[1.8rem]' : 'size-[2.6rem]'} text-white`} strokeWidth={2.6} />
      {holding && (
        <svg className="absolute -inset-[0.5rem] size-[calc(100%+1rem)] -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--accent-ink)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="289"
            strokeDashoffset="289"
            style={{ animation: `hold-ring ${HOLD_MS}ms linear forwards` }}
          />
        </svg>
      )}
    </div>
  )
  const label = <div className={`font-black tracking-tight ${compact ? 'text-[1.75rem]' : 'text-[2.4rem]'}`}>{name}</div>

  if (!onLongPress) {
    return (
      <div className="flex items-center gap-4">
        {icon}
        {label}
      </div>
    )
  }
  return (
    <button
      type="button"
      data-nav=""
      data-nav-compact=""
      aria-label={name}
      // Nessuna azione col semplice OK: solo tenendo premuto 3 secondi
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (!keyDown.current) {
            keyDown.current = true
            start()
          }
        }
      }}
      onKeyUp={(e) => (e.key === 'Enter' || e.key === ' ') && cancel()}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onBlur={cancel}
      onClick={(e) => e.preventDefault()}
      className="-m-2 flex w-fit items-center gap-4 rounded-[1.4rem] border-2 border-transparent p-2 pr-4 text-left"
    >
      {icon}
      {label}
    </button>
  )
}
