import { useEffect, useRef } from 'react'

const SEGMENTS = 24

/**
 * Indicatore di livello orizzontale (verde → giallo → rosso), sempre visibile
 * per capire se il microfono "arriva". Disegnato direttamente nel DOM a ~30 fps,
 * senza far ridisegnare React (leggero per l'N150).
 */
export function VuMeter({ analyser, className = '' }: { analyser: AnalyserNode | null; className?: string }) {
  const segs = useRef<HTMLSpanElement[]>([])

  useEffect(() => {
    const list = segs.current
    if (!analyser) {
      list.forEach((s) => s.removeAttribute('data-on'))
      return
    }
    const buf = new Float32Array(analyser.fftSize)
    let raf = 0
    let last = 0
    let level = 0
    let peak = 0
    let peakAt = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 33) return
      last = t
      analyser.getFloatTimeDomainData(buf)
      let max = 0
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i])
        if (v > max) max = v
      }
      // Scala in dB: -48 dB → vuoto, 0 dB → pieno
      const db = 20 * Math.log10(max || 1e-6)
      const target = Math.min(1, Math.max(0, (db + 48) / 48))
      level = target > level ? target : level * 0.85 + target * 0.15 // salita rapida, discesa morbida
      if (level >= peak || t - peakAt > 1200) {
        peak = level
        peakAt = t
      }
      const on = Math.round(level * SEGMENTS)
      const peakIdx = Math.max(0, Math.round(peak * SEGMENTS) - 1)
      for (let i = 0; i < SEGMENTS; i++) {
        if (i < on || (i === peakIdx && peak > 0.05)) list[i]?.setAttribute('data-on', '')
        else list[i]?.removeAttribute('data-on')
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [analyser])

  return (
    <div className={`flex h-[2.2rem] items-stretch gap-[0.18rem] ${className}`} aria-label="Livello del microfono">
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const color = i < SEGMENTS * 0.65 ? 'vu-green' : i < SEGMENTS * 0.85 ? 'vu-yellow' : 'vu-red'
        return (
          <span
            key={i}
            ref={(el) => {
              if (el) segs.current[i] = el
            }}
            className={`vu-seg ${color} flex-1 rounded-[0.2rem]`}
          />
        )
      })}
    </div>
  )
}
