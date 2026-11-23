import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Mic, MicOff, RotateCcw, Search, X } from 'lucide-react'
import type { VoiceStatus } from '../../electron/ipc-types'
import { Button } from './Button'
import { useBackHandler } from '../navigation/RemoteKeys'
import { focusDefault } from '../navigation/spatial'
import { pushOverlay } from '../lib/overlays'
import { studio } from '../lib/api'
import { VoiceEngine, pickVoiceDevice } from '../lib/voice'

type Phase = 'listening' | 'thinking' | 'result' | 'error'

const MAX_MS = 8000 // ascolto massimo
const NO_SPEECH_MS = 5000 // nessuna parola entro 5 s → stop
const SILENCE_MS = 1200 // silenzio dopo aver parlato → fine
const SPEECH_DB = -38
const SILENCE_DB = -46

interface Props {
  /** Titolo in alto, es. "Cerca con la voce" */
  title: string
  /** Suggerimento, es. "Dì il titolo della canzone" */
  hint: string
  /** Testo del pulsante di conferma, es. "Cerca" */
  confirmLabel: string
  /** Motore già aperto (ascolto automatico del telecomando); altrimenti ne apre uno */
  engine?: VoiceEngine
  /** L'ascolto è partito perché si stava già parlando: usa il pre‑ascolto */
  preroll?: boolean
  onResult: (text: string) => void
  onClose: () => void
}

/** "Ti ascolto…" → "Sto capendo…" → "Ho capito: «…»" */
export function VoiceOverlay({ title, hint, confirmLabel, engine: shared, preroll = false, onResult, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('listening')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [level, setLevel] = useState(-100)
  const [model, setModel] = useState<VoiceStatus>({ state: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const own = useRef<VoiceEngine | null>(null)

  useEffect(() => pushOverlay(), [])
  useBackHandler(() => {
    onClose()
  })

  useEffect(() => {
    studio.voice.status().then(setModel)
    return studio.voice.onStatus(setModel)
  }, [])

  // Ascolto
  useEffect(() => {
    let alive = true
    let timer: number | undefined
    const run = async () => {
      setPhase('listening')
      setText('')
      let engine = shared
      if (!engine || !engine.isOpen) {
        try {
          const s = await studio.settings.get()
          const dev = await pickVoiceDevice(s.voiceMicLabel, s.mixerLabelHint)
          if (!dev) throw new Error('Non trovo nessun microfono')
          own.current ??= new VoiceEngine()
          if (!own.current.isOpen) await own.current.open(dev.deviceId)
          engine = own.current
        } catch (e) {
          if (!alive) return
          setError((e as Error).message || 'Non riesco ad aprire il microfono')
          setPhase('error')
          return
        }
      }
      if (!alive) return
      const eng = engine
      eng.start(preroll && attempt === 0)
      const started = performance.now()
      let spoke = preroll && attempt === 0
      let lastLoud = performance.now()
      timer = window.setInterval(async () => {
        const now = performance.now()
        setLevel(eng.level)
        if (eng.level > SPEECH_DB) {
          spoke = true
          lastLoud = now
        } else if (eng.level > SILENCE_DB) {
          lastLoud = spoke ? now : lastLoud
        }
        const done =
          now - started > MAX_MS || (!spoke && now - started > NO_SPEECH_MS) || (spoke && now - lastLoud > SILENCE_MS)
        if (!done) return
        window.clearInterval(timer)
        const samples = eng.finish()
        if (!spoke) {
          setError('Non ho sentito niente')
          setPhase('error')
          return
        }
        setPhase('thinking')
        try {
          const t = await studio.voice.transcribe(samples)
          if (!alive) return
          if (!t) {
            setError('Non ho capito bene')
            setPhase('error')
          } else {
            setText(t)
            setPhase('result')
          }
        } catch {
          if (!alive) return
          setError('La voce non è ancora pronta: serve internet la prima volta')
          setPhase('error')
        }
      }, 100)
    }
    run()
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [attempt, shared, preroll])

  useEffect(() => () => own.current?.close(), [])

  // Con il risultato: conferma automatica dopo 2,5 secondi
  useEffect(() => {
    if (phase !== 'result') return
    const id = window.setTimeout(() => onResult(text), 2500)
    return () => window.clearTimeout(id)
  }, [phase, text, onResult])

  useEffect(() => {
    requestAnimationFrame(() => focusDefault())
  }, [phase])

  const ring = Math.min(1, Math.max(0, (level + 60) / 50))

  return createPortal(
    <div data-nav-scope="" className="t-overlay anim-fade fixed inset-0 z-50 flex items-center justify-center">
      <div className="t-dialog anim-pop flex w-[60rem] max-w-[94vw] flex-col items-center gap-7 rounded-[2.25rem] border-2 px-12 py-11 text-center shadow-2xl">
        <h2 className="text-[2.6rem] font-black">{title}</h2>

        {phase === 'listening' && (
          <>
            <div className="relative flex size-[13rem] items-center justify-center">
              <span
                className="absolute inset-0 rounded-full bg-rec/25 transition-transform duration-100"
                style={{ transform: `scale(${0.7 + ring * 0.5})` }}
              />
              <span className="anim-rec absolute inset-[2.2rem] rounded-full bg-rec/30" />
              <span className="relative flex size-[8rem] items-center justify-center rounded-full bg-rec text-white shadow-xl">
                <Mic className="size-[4.2rem]" strokeWidth={2.4} />
              </span>
            </div>
            <div className="text-[2.2rem] font-black">Ti ascolto… parla adesso</div>
            <div className="t-muted text-[1.6rem] font-bold">{hint}</div>
            <Button variant="neutral" icon={<X />} autoFocusNav onClick={onClose}>
              Annulla
            </Button>
          </>
        )}

        {phase === 'thinking' && (
          <>
            <Loader2 className="t-accent-ink size-[7rem] animate-spin" />
            <div className="text-[2.2rem] font-black">Sto capendo…</div>
            {model.state === 'loading' && (
              <div className="t-muted text-[1.5rem] font-bold">Preparo la voce per la prima volta: {model.progress}%</div>
            )}
          </>
        )}

        {phase === 'result' && (
          <>
            <div className="t-muted text-[1.7rem] font-bold">Ho capito:</div>
            <div className="t-surface max-w-full rounded-[1.4rem] border-2 px-8 py-5 text-[2.6rem] leading-tight font-black">«{text}»</div>
            <div className="flex gap-5">
              <Button variant="success" icon={<Search />} autoFocusNav onClick={() => onResult(text)}>
                {confirmLabel}
              </Button>
              <Button variant="neutral" icon={<RotateCcw />} onClick={() => setAttempt((a) => a + 1)}>
                Riprova
              </Button>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <MicOff className="t-muted size-[6rem]" />
            <div className="text-[2.2rem] font-black">{error}</div>
            <div className="flex gap-5">
              <Button variant="accent" icon={<RotateCcw />} autoFocusNav onClick={() => setAttempt((a) => a + 1)}>
                Riprova
              </Button>
              <Button variant="neutral" icon={<X />} onClick={onClose}>
                Annulla
              </Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
