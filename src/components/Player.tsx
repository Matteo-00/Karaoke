import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Disc3, Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import type { Recording } from '../../electron/ipc-types'
import { useBackHandler } from '../navigation/RemoteKeys'
import { studio } from '../lib/api'
import { duration } from '../lib/text'

/**
 * Player a schermo intero.
 * OK = play/pausa · ◀ ▶ = indietro/avanti 10 secondi · Indietro = chiudi
 */
export function Player({ recording, onClose }: { recording: Recording; onClose: () => void }) {
  const audio = useRef<HTMLAudioElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [total, setTotal] = useState(recording.durationSec)
  const [error, setError] = useState(false)

  useBackHandler(() => {
    onClose()
  })

  // Il file arriva dal processo principale e diventa un URL locale
  useEffect(() => {
    let url: string | null = null
    studio.library
      .readAudio(recording.id)
      .then((buf) => {
        url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }))
        setSrc(url)
      })
      .catch(() => setError(true))
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [recording.id])

  useEffect(() => {
    requestAnimationFrame(() => box.current?.focus())
  }, [])

  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) a.play().catch(() => undefined)
    else a.pause()
  }
  const seek = (delta: number) => {
    const a = audio.current
    if (!a) return
    a.currentTime = Math.min(Math.max(0, a.currentTime + delta), a.duration || total)
    setTime(a.currentTime)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'MediaPlayPause') {
      e.preventDefault()
      toggle()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      seek(-10)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      seek(10)
    }
  }

  const pct = total > 0 ? Math.min(100, (time / total) * 100) : 0

  return createPortal(
    <div data-nav-scope="" className="t-bg anim-fade fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 px-[6rem]">
      <div
        ref={box}
        tabIndex={-1}
        data-nav=""
        data-nav-plain=""
        data-nav-capture=""
        data-autofocus=""
        onKeyDown={onKeyDown}
        className="flex w-full flex-col items-center gap-10 outline-none"
      >
        <Disc3
          className={`t-accent-ink size-[12rem] ${playing ? 'animate-spin' : ''}`}
          style={{ animationDuration: '3s' }}
          strokeWidth={1.4}
        />
        <h2 className="max-w-full truncate text-center text-[3rem] font-black">{recording.title}</h2>

        {error ? (
          <div className="text-[1.8rem] font-bold text-rec">Non riesco ad aprire questa registrazione</div>
        ) : (
          <>
            {/* Barra di avanzamento */}
            <div className="w-full max-w-[64rem]">
              <div className="t-btn-neutral h-[1.4rem] w-full overflow-hidden rounded-full border-2">
                <div className="h-full rounded-full bg-[var(--card2)] transition-[width] duration-200" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-[2rem] font-black tabular-nums">
                <span>{duration(time)}</span>
                <span className="t-muted">{duration(total)}</span>
              </div>
            </div>

            <div className="flex items-center gap-10">
              <button type="button" onClick={() => seek(-10)} className="t-btn-neutral flex size-[6.5rem] flex-col items-center justify-center rounded-full border-2 text-[1.2rem] font-black">
                <RotateCcw className="size-[2.4rem]" />
                10 s
              </button>
              <button
                type="button"
                onClick={toggle}
                className="t-btn-accent flex size-[9rem] items-center justify-center rounded-full border-2 shadow-xl"
                aria-label={playing ? 'Pausa' : 'Play'}
              >
                {playing ? <Pause className="size-[4.5rem] fill-current" /> : <Play className="size-[4.5rem] translate-x-[0.3rem] fill-current" />}
              </button>
              <button type="button" onClick={() => seek(10)} className="t-btn-neutral flex size-[6.5rem] flex-col items-center justify-center rounded-full border-2 text-[1.2rem] font-black">
                <RotateCw className="size-[2.4rem]" />
                10 s
              </button>
            </div>
          </>
        )}

        <div className="t-muted text-center text-[1.6rem] font-bold">
          <b style={{ color: 'var(--text)' }}>OK</b> play/pausa · <b style={{ color: 'var(--text)' }}>◀ ▶</b> 10 secondi ·{' '}
          <b style={{ color: 'var(--text)' }}>Indietro</b> per chiudere
        </div>
      </div>

      {src && (
        <audio
          ref={audio}
          src={src}
          autoPlay
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setTotal(e.currentTarget.duration)}
        />
      )}
    </div>,
    document.body
  )
}
