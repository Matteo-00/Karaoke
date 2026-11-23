import { useCallback, useEffect, useRef, useState } from 'react'
import { Circle, Headphones, Loader2, MonitorPlay } from 'lucide-react'
import type { ViewBounds, YtEvent } from '../../electron/ipc-types'
import { ScreenHeader } from '../components/ScreenHeader'
import { RecordingBar, type RecStatus } from '../components/RecordingBar'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { Countdown } from '../components/Countdown'
import { useToast } from '../components/Toast'
import { useBackHandler } from '../navigation/RemoteKeys'
import { useOverlayCount } from '../lib/overlays'
import { studio } from '../lib/api'

interface VideoState {
  videoId: string | null
  title: string
  playing: boolean
  ad: boolean
}

/**
 * Schermata "YouTube – Canta": barra in alto, YouTube al centro,
 * barra "Registrazione" in basso.
 *
 * Flusso: play su YouTube → il video si ferma → "Vuoi registrare?" →
 * conto alla rovescia 5-4-3-2-1-VAI! → il video riparte da capo.
 */
export function YouTubeScreen({ onHome, countdownSeconds }: { onHome: () => void; countdownSeconds: number }) {
  const yt = studio.youtube
  const toast = useToast()
  const areaRef = useRef<HTMLDivElement>(null)
  const overlays = useOverlayCount()
  const overlaysRef = useRef(overlays)
  overlaysRef.current = overlays

  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [video, setVideo] = useState<VideoState>({ videoId: null, title: '', playing: false, ad: false })
  const [ask, setAsk] = useState<{ videoId: string; title: string } | null>(null)
  const [countingDown, setCountingDown] = useState(false)
  const [status, setStatus] = useState<RecStatus>('ready')

  const bounds = useCallback((): ViewBounds | null => {
    const el = areaRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, width: r.width, height: r.height }
  }, [])

  // ------------------------------------------------ YouTube visibile / nascosto
  // Con un dialog o il conto alla rovescia aperti, YouTube (vista nativa) si
  // nasconde e al suo posto resta la foto dell'ultimo fotogramma.
  const visToken = useRef(0)
  useEffect(() => {
    const token = ++visToken.current
    if (overlays > 0) {
      yt.hide(true).then((img) => {
        if (token === visToken.current && img) setSnapshot(img)
      })
      return
    }
    const id = requestAnimationFrame(() => {
      const b = bounds()
      if (token === visToken.current && b) yt.show(b)
    })
    return () => cancelAnimationFrame(id)
  }, [overlays, yt, bounds])

  // Ridimensionamenti della finestra
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const b = bounds()
      if (b && overlaysRef.current === 0) yt.setBounds(b)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [yt, bounds])

  // Uscendo dalla schermata: pausa e YouTube nascosto
  useEffect(
    () => () => {
      yt.command('pause')
      yt.hide(false)
      document.documentElement.removeAttribute('data-window-blurred')
    },
    [yt]
  )

  // ------------------------------------------------ navigazione
  const goBack = useCallback(() => {
    yt.goBack().then((went) => {
      if (!went) onHome()
    })
  }, [yt, onHome])

  useBackHandler(() => {
    goBack()
  })

  // ------------------------------------------------ eventi da YouTube
  const askTimer = useRef<number | undefined>(undefined)
  const titleRef = useRef<{ id: string | null; title: string }>({ id: null, title: '' })
  /** Il video per cui la barra mostra "Solo ascolto" */
  const listeningId = useRef<string | null>(null)
  useEffect(() => () => window.clearTimeout(askTimer.current), [])

  const handlers = useRef({ goBack, onHome })
  handlers.current = { goBack, onHome }

  useEffect(() => {
    return yt.onEvent((e: YtEvent) => {
      switch (e.type) {
        case 'video-start':
          // Nuovo video: è già fermo all'inizio, chiediamo cosa fare.
          // Aspettiamo un attimo che la pagina mostri il video fermo, così la
          // foto dietro al messaggio è quella giusta.
          setCountingDown(false)
          setStatus('ready')
          setVideo((v) => ({ ...v, videoId: e.videoId, title: e.title }))
          window.clearTimeout(askTimer.current)
          askTimer.current = window.setTimeout(() => {
            setAsk((a) => a ?? { videoId: e.videoId, title: titleRef.current.id === e.videoId ? titleRef.current.title : e.title })
          }, 350)
          break
        case 'meta':
          titleRef.current = { id: e.videoId, title: e.title }
          setAsk((a) => (a && a.videoId === e.videoId ? { ...a, title: e.title } : a))
          setVideo((v) => (v.videoId === e.videoId ? { ...v, title: e.title } : v))
          break
        case 'state':
          setVideo({ videoId: e.videoId, title: e.title, playing: e.playing, ad: e.ad })
          // Cambiando video (o uscendo dalla pagina del video) "Solo ascolto" torna "Pronto"
          if (e.videoId !== listeningId.current) setStatus((s) => (s === 'listening' ? 'ready' : s))
          break
        case 'ended':
          setStatus((s) => (s === 'listening' ? 'ready' : s))
          break
        case 'focus':
          // Mentre si usa YouTube il bordo giallo dell'interfaccia non serve
          if (e.youtube) document.documentElement.setAttribute('data-window-blurred', '')
          else document.documentElement.removeAttribute('data-window-blurred')
          break
        case 'key':
          if (e.key === 'back') handlers.current.goBack()
          else handlers.current.onHome()
          break
      }
    })
  }, [yt])

  // ------------------------------------------------ azioni
  const startCountdown = () => {
    setStatus('countdown')
    setCountingDown(true)
  }

  const chooseRecord = () => {
    setAsk(null)
    startCountdown()
  }

  const chooseListen = () => {
    listeningId.current = ask?.videoId ?? video.videoId
    setAsk(null)
    yt.command('play')
    setStatus('listening')
  }

  const closeAsk = () => {
    // Indietro: il video resta fermo, si può premere play per ascoltare o "Registra"
    setAsk(null)
    yt.command('release')
    setStatus('ready')
  }

  const manualRecord = () => {
    yt.command('hold')
    yt.command('restart')
    startCountdown()
  }

  const canRecord = !!video.videoId && !video.ad && (status === 'ready' || status === 'listening')

  return (
    <div className="relative z-10 flex h-full flex-col">
      <ScreenHeader
        title={video.videoId && video.title ? video.title : 'YouTube – Canta'}
        icon={<MonitorPlay className="t-power" />}
        onHome={onHome}
      />

      {/* Area di YouTube: qui sopra si posiziona la vista nativa */}
      <div ref={areaRef} className="relative flex-1 overflow-hidden bg-black">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[1.75rem] font-bold text-white/70">
          <Loader2 className="size-[3.5rem] animate-spin" />
          Sto aprendo YouTube…
        </div>
        {snapshot && <img src={snapshot} alt="" className="absolute inset-0 h-full w-full object-fill" />}
      </div>

      <RecordingBar
        status={status}
        seconds={0}
        songTitle={video.videoId ? video.title : ''}
        canRecord={canRecord}
        onRecord={manualRecord}
        onStop={() => undefined}
      />

      {ask && (
        <Dialog
          title="Vuoi registrare?"
          icon={<Circle className="fill-current text-rec" />}
          onClose={closeAsk}
          width="lg"
          actions={
            <>
              <Button variant="danger" icon={<Circle className="fill-current" />} autoFocusNav onClick={chooseRecord} className="min-w-[22rem]">
                Sì, registra
              </Button>
              <Button variant="neutral" icon={<Headphones />} onClick={chooseListen} className="min-w-[22rem]">
                Solo ascolto
              </Button>
            </>
          }
        >
          Stai avviando <b style={{ color: 'var(--text)' }}>«{ask.title || 'questa canzone'}»</b>
        </Dialog>
      )}

      {countingDown && (
        <Countdown
          seconds={countdownSeconds}
          onGo={() => {
            yt.command('play')
            // Fase 2: la registrazione vera e propria arriva nella fase 3
            listeningId.current = video.videoId
            setStatus('listening')
            toast({ tone: 'info', message: 'Registrazione: in arrivo nella fase 3 🎤' })
          }}
          onDone={() => setCountingDown(false)}
          onCancel={() => {
            setCountingDown(false)
            yt.command('release')
            setStatus('ready')
          }}
        />
      )}
    </div>
  )
}
