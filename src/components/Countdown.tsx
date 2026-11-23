import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackHandler } from '../navigation/RemoteKeys'
import { pushOverlay } from '../lib/overlays'

interface Props {
  seconds: number
  /** Bip leggero a ogni numero (di default no: finirebbe nella registrazione) */
  beep?: boolean
  /** Chiamato circa 200 ms prima del "VAI!" (lì partirà la registrazione) */
  onAlmost?: () => void
  /** Chiamato al "VAI!": il video riparte */
  onGo: () => void
  /** Chiamato quando l'overlay è sparito */
  onDone: () => void
  /** Tasto Indietro: annulla */
  onCancel: () => void
}

/**
 * Conto alla rovescia a tutto schermo: 5 → 4 → 3 → 2 → 1 → VAI!
 * Numeri enormi (40% dell'altezza) con zoom e dissolvenza.
 */
export function Countdown({ seconds, beep = false, onAlmost, onGo, onDone, onCancel }: Props) {
  const [value, setValue] = useState(seconds) // 0 = "VAI!"
  const [leaving, setLeaving] = useState(false)
  const cbs = useRef({ onAlmost, onGo, onDone })
  cbs.current = { onAlmost, onGo, onDone }

  useEffect(() => pushOverlay(), [])

  useEffect(() => {
    const timers: number[] = []
    for (let i = 1; i <= seconds; i++) {
      timers.push(window.setTimeout(() => setValue(seconds - i), i * 1000))
    }
    timers.push(window.setTimeout(() => cbs.current.onAlmost?.(), seconds * 1000 - 200))
    timers.push(window.setTimeout(() => cbs.current.onGo(), seconds * 1000))
    timers.push(window.setTimeout(() => setLeaving(true), seconds * 1000 + 600))
    timers.push(window.setTimeout(() => cbs.current.onDone(), seconds * 1000 + 1100))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [seconds])

  // Bip: breve tono locale, più acuto sul "VAI!"
  useEffect(() => {
    if (!beep) return
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = value === 0 ? 1320 : 880
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15)
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.16)
      osc.onended = () => ctx.close()
    } catch {
      /* audio non disponibile */
    }
  }, [value, beep])

  useBackHandler(() => {
    if (value > 0) onCancel()
  })

  const go = value === 0
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/55 transition-opacity duration-500 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        key={value}
        className={`[animation:countdown-pop_900ms_cubic-bezier(0.2,0.9,0.3,1)_both] leading-none font-black tabular-nums ${
          go ? 'text-[28vh] text-[#4ade80]' : 'text-[40vh] text-white'
        }`}
        style={{ textShadow: '0 0.5rem 3rem rgb(0 0 0 / 0.5)' }}
      >
        {go ? 'VAI!' : value}
      </div>
      {!go && (
        <div className="mt-4 rounded-full bg-black/40 px-8 py-3 text-[1.75rem] font-extrabold text-white/90">
          Preparati a cantare… · <span className="text-white/70">Indietro per annullare</span>
        </div>
      )}
    </div>,
    document.body
  )
}
