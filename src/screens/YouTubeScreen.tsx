import { useCallback, useEffect, useRef, useState } from 'react'
import { Circle, Headphones, Loader2, Mic, MonitorPlay, Play, Save, Square, Trash2 } from 'lucide-react'
import type { ViewBounds, YtEvent } from '../../electron/ipc-types'
import { ScreenHeader } from '../components/ScreenHeader'
import { RecordingBar, type RecStatus } from '../components/RecordingBar'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { Countdown } from '../components/Countdown'
import { SaveFlow } from '../components/SaveFlow'
import { useToast } from '../components/Toast'
import { useBackHandler } from '../navigation/RemoteKeys'
import { useOverlayCount } from '../lib/overlays'
import { studio } from '../lib/api'
import { cleanSongTitle, defaultRecordingName } from '../lib/text'
import { useMixerInput } from '../hooks/useMixerInput'
import { useRecorder } from '../hooks/useRecorder'
import { VoiceOverlay } from '../components/VoiceOverlay'
import { VoiceEngine, pickVoiceDevice } from '../lib/voice'

/** Tasti standard che avviano la ricerca vocale (oltre a quello scelto nelle impostazioni) */
const VOICE_KEYS = ['BrowserSearch', 'LaunchAssistant', 'MicrophoneToggle', 'F24']

interface VideoState {
  videoId: string | null
  title: string
  playing: boolean
  ad: boolean
}

interface AskState {
  videoId: string
  title: string
}

/** Perché chiediamo "Vuoi salvare?" durante una registrazione */
type ConfirmReason = 'leave' | 'back' | 'newVideo'

interface Props {
  onHome: () => void
  countdownSeconds: number
  /** Bip a ogni numero del conto alla rovescia */
  beep?: boolean
  /** Registra la funzione che l'app chiama prima di lasciare la schermata (tasto Home) */
  setLeaveGuard: (guard: (() => boolean) | null) => void
}

/**
 * Schermata "YouTube – Canta": barra in alto, YouTube al centro,
 * barra "Registrazione" in basso.
 *
 * Flusso: play su YouTube → il video si ferma → "Vuoi registrare?" →
 * 5-4-3-2-1-VAI! (la registrazione parte ~200 ms prima del video) →
 * fine canzone o STOP → nome → cartella → MP3 salvato.
 */
export function YouTubeScreen({ onHome, countdownSeconds, beep = false, setLeaveGuard }: Props) {
  const yt = studio.youtube
  const toast = useToast()
  const areaRef = useRef<HTMLDivElement>(null)
  const overlays = useOverlayCount()
  const overlaysRef = useRef(overlays)
  overlaysRef.current = overlays

  const mixer = useMixerInput(true)
  const recorder = useRecorder(mixer.stream)

  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [video, setVideo] = useState<VideoState>({ videoId: null, title: '', playing: false, ad: false })
  const [ask, setAsk] = useState<AskState | null>(null)
  const [countingDown, setCountingDown] = useState(false)
  const [status, setStatus] = useState<RecStatus>('ready')
  const [save, setSave] = useState<{ tempId: string; durationSec: number; name: string } | null>(null)
  const [confirm, setConfirm] = useState<ConfirmReason | null>(null)
  /** Ricerca vocale aperta (preroll = partita da sola perché si stava parlando) */
  const [voice, setVoice] = useState<{ preroll: boolean } | null>(null)
  const voiceEngine = useRef<VoiceEngine | null>(null)
  const voiceKeys = useRef<string[]>(VOICE_KEYS)

  // Valori sempre aggiornati per i gestori di eventi
  const statusRef = useRef(status)
  statusRef.current = status
  const videoRef = useRef(video)
  videoRef.current = video
  const busyRef = useRef(false) // dialog di salvataggio o conferma aperti
  busyRef.current = !!save || !!confirm || !!voice
  /** Canzone in registrazione */
  const recSong = useRef<{ videoId: string | null; title: string }>({ videoId: null, title: '' })
  /** Cosa fare quando il salvataggio è finito */
  const after = useRef<{ home?: boolean; ask?: AskState }>({})
  /** Subito dopo il "VAI!" ignoriamo le pause (il video sta ancora partendo) */
  const graceUntil = useRef(0)
  const startedRec = useRef(false)
  const listeningId = useRef<string | null>(null)
  const askTimer = useRef<number | undefined>(undefined)
  const titleRef = useRef<{ id: string | null; title: string }>({ id: null, title: '' })

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

  useEffect(
    () => () => {
      window.clearTimeout(askTimer.current)
      yt.command('pause')
      yt.hide(false)
      document.documentElement.removeAttribute('data-window-blurred')
    },
    [yt]
  )

  // ------------------------------------------------ fine registrazione
  /** Ferma la registrazione e apre il salvataggio */
  const finishRecording = useCallback(async () => {
    if (statusRef.current !== 'recording' && statusRef.current !== 'paused') return
    statusRef.current = 'saving'
    setStatus('saving')
    yt.command('pause')
    const res = await recorder.stop()
    if (!res) {
      toast({ tone: 'error', message: 'La registrazione non è riuscita' })
      setStatus('ready')
      return
    }
    setSave({ tempId: res.tempId, durationSec: res.durationSec, name: defaultRecordingName(recSong.current.title) })
  }, [recorder, toast, yt])

  /** Ferma e scarta (va comunque tra le eliminate, recuperabile) */
  const discardRecording = useCallback(async () => {
    statusRef.current = 'saving'
    setStatus('saving')
    const res = await recorder.stop()
    if (res) {
      studio.library.discardTemp(res.tempId).catch(() => undefined)
      toast({ tone: 'info', message: 'Scartata: la trovi in «Registrazioni eliminate»' })
    }
    setStatus('ready')
  }, [recorder, toast])

  /** Dopo il salvataggio: torna alla Home o chiede per la nuova canzone */
  const afterSave = useCallback(() => {
    setSave(null)
    setStatus('ready')
    const next = after.current
    after.current = {}
    if (next.home) onHome()
    else if (next.ask && next.ask.videoId === videoRef.current.videoId) setAsk(next.ask)
  }, [onHome])

  // ------------------------------------------------ uscire dalla schermata
  const isRecording = () => statusRef.current === 'recording' || statusRef.current === 'paused'

  /** true = abbiamo bloccato l'uscita (c'è qualcosa da decidere prima) */
  const guard = useCallback((): boolean => {
    if (save || statusRef.current === 'saving') return true
    if (isRecording()) {
      setConfirm('leave')
      return true
    }
    return false
  }, [save])

  useEffect(() => {
    setLeaveGuard(guard)
    return () => setLeaveGuard(null)
  }, [guard, setLeaveGuard])

  const leave = useCallback(() => {
    if (!guard()) onHome()
  }, [guard, onHome])

  const goBack = useCallback(() => {
    if (isRecording()) {
      setConfirm('back')
      return
    }
    if (save || statusRef.current === 'saving') return
    yt.goBack().then((went) => {
      if (!went) onHome()
    })
  }, [yt, onHome, save])

  useBackHandler(() => {
    goBack()
  })

  // Tasto STOP del telecomando (se presente)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'MediaStop' && isRecording()) {
        e.preventDefault()
        finishRecording()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finishRecording])

  // ------------------------------------------------ ricerca vocale
  /** Si può usare la voce solo quando non si registra e non c'è un altro dialog */
  const canVoice = () =>
    !busyRef.current && overlaysRef.current === 0 && (statusRef.current === 'ready' || statusRef.current === 'listening')

  const openVoice = useCallback((preroll = false) => {
    if (!canVoice()) return
    // Se una canzone sta suonando la mettiamo in pausa, così si sente la voce
    if (videoRef.current.playing && statusRef.current !== 'recording') yt.command('pause')
    setVoice({ preroll })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yt])

  // Tasto del microfono quando il focus è sull'interfaccia
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (voiceKeys.current.includes(e.key) || voiceKeys.current.includes(e.code)) {
        e.preventDefault()
        openVoice()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openVoice])

  // Ascolto automatico del microfono del telecomando: si tiene premuto il
  // tasto del microfono, si parla e la ricerca parte da sola
  useEffect(() => {
    let alive = true
    let loudSince = 0
    let timer: number | undefined
    ;(async () => {
      const s = await studio.settings.get()
      if (s.voiceKey) voiceKeys.current = [...VOICE_KEYS, s.voiceKey]
      if (!s.voiceAuto) return
      const dev = await pickVoiceDevice(s.voiceMicLabel, s.mixerLabelHint)
      // Solo con un microfono separato dal mixer (altrimenti partirebbe cantando)
      if (!alive || !dev?.separate) return
      const eng = new VoiceEngine()
      try {
        await eng.open(dev.deviceId)
      } catch {
        return
      }
      if (!alive) return eng.close()
      voiceEngine.current = eng
      timer = window.setInterval(() => {
        // Mai mentre suona una canzone o si registra
        if (!canVoice() || videoRef.current.playing) {
          loudSince = 0
          return
        }
        if (eng.level > -38) {
          loudSince ||= performance.now()
          if (performance.now() - loudSince > 300) {
            loudSince = 0
            openVoice(true)
          }
        } else loudSince = 0
      }, 100)
    })()
    return () => {
      alive = false
      window.clearInterval(timer)
      voiceEngine.current?.close()
      voiceEngine.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------------------------------------------ eventi da YouTube
  const handlers = useRef({ goBack, leave, finishRecording, recorder, openVoice })
  handlers.current = { goBack, leave, finishRecording, recorder, openVoice }

  useEffect(() => {
    return yt.onEvent((e: YtEvent) => {
      const h = handlers.current
      switch (e.type) {
        case 'video-start': {
          const next = { videoId: e.videoId, title: e.title }
          setCountingDown(false)
          setVideo((v) => ({ ...v, videoId: e.videoId, title: e.title }))
          if (isRecording()) {
            // Cambio di canzone durante la registrazione: pausa e domanda
            h.recorder.pause()
            statusRef.current = 'paused'
            setStatus('paused')
            after.current.ask = next
            setConfirm('newVideo')
            break
          }
          if (busyRef.current || statusRef.current === 'saving') {
            after.current.ask = next
            break
          }
          setStatus('ready')
          // Aspettiamo che la pagina mostri il video fermo, così la foto dietro
          // al messaggio è quella giusta
          window.clearTimeout(askTimer.current)
          askTimer.current = window.setTimeout(() => {
            if (busyRef.current) {
              after.current.ask = next
              return
            }
            setAsk((a) => a ?? { ...next, title: titleRef.current.id === e.videoId ? titleRef.current.title : e.title })
          }, 350)
          break
        }
        case 'meta':
          titleRef.current = { id: e.videoId, title: e.title }
          setAsk((a) => (a && a.videoId === e.videoId ? { ...a, title: e.title } : a))
          setVideo((v) => (v.videoId === e.videoId ? { ...v, title: e.title } : v))
          if (recSong.current.videoId === e.videoId) recSong.current.title = e.title
          break
        case 'state': {
          setVideo({ videoId: e.videoId, title: e.title, playing: e.playing, ad: e.ad })
          if (e.videoId !== listeningId.current) setStatus((s) => (s === 'listening' ? 'ready' : s))
          const st = statusRef.current
          const sameSong = e.videoId === recSong.current.videoId
          // Pubblicità o video in pausa → registrazione in pausa
          if (st === 'recording' && performance.now() > graceUntil.current && (e.ad || (!e.playing && !e.ended))) {
            h.recorder.pause()
            statusRef.current = 'paused'
            setStatus('paused')
          }
          // Torna la canzone → la registrazione riprende (senza conto alla rovescia)
          if (st === 'paused' && sameSong && e.playing && !e.ad && !busyRef.current) {
            h.recorder.resume()
            statusRef.current = 'recording'
            setStatus('recording')
          }
          break
        }
        case 'ended':
          if (isRecording()) h.finishRecording()
          else setStatus((s) => (s === 'listening' ? 'ready' : s))
          break
        case 'focus':
          // Mentre si usa YouTube il bordo giallo dell'interfaccia non serve
          if (e.youtube) document.documentElement.setAttribute('data-window-blurred', '')
          else document.documentElement.removeAttribute('data-window-blurred')
          break
        case 'key':
          if (e.key === 'back') h.goBack()
          else if (e.key === 'home') h.leave()
          else if (e.key === 'stop' && isRecording()) h.finishRecording()
          else if (e.key === 'voice') h.openVoice()
          break
      }
    })
  }, [yt])

  // ------------------------------------------------ azioni
  const startCountdown = () => {
    if (!mixer.stream) {
      toast({ tone: 'error', message: 'Non sento il mixer: controlla il cavo USB' })
      yt.command('release')
      setStatus('ready')
      return
    }
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
    // Indietro: il video resta fermo; si può premere play per ascoltare o "Registra"
    setAsk(null)
    yt.command('release')
    setStatus('ready')
  }

  const manualRecord = () => {
    yt.command('hold')
    yt.command('restart')
    startCountdown()
  }

  const confirmSave = () => {
    if (confirm === 'leave') after.current.home = true
    setConfirm(null)
    finishRecording()
  }

  const confirmDiscard = async () => {
    const reason = confirm
    setConfirm(null)
    await discardRecording()
    if (reason === 'leave') {
      onHome()
    } else if (after.current.ask) {
      const next = after.current.ask
      after.current = {}
      setAsk(next)
    }
  }

  const recordingNow = status === 'recording' || status === 'paused'
  const canRecord = !!video.videoId && !video.ad && (status === 'ready' || status === 'listening')

  return (
    <div className="relative z-10 flex h-full flex-col">
      <ScreenHeader
        title={video.videoId && video.title ? video.title : 'YouTube – Canta'}
        icon={<MonitorPlay className="t-power" />}
        onHome={leave}
        extra={
          <button
            type="button"
            data-nav=""
            data-nav-compact=""
            disabled={status === 'recording' || status === 'paused' || status === 'countdown' || status === 'saving'}
            onClick={() => openVoice()}
            className="t-btn-danger flex h-[4rem] shrink-0 items-center gap-2 rounded-[1.2rem] border-2 px-5 text-[1.5rem] font-extrabold"
          >
            <Mic className="size-[1.9rem]" strokeWidth={2.6} />
            Cerca con la voce
          </button>
        }
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
        seconds={recordingNow || status === 'saving' ? recorder.seconds : 0}
        songTitle={recordingNow ? recSong.current.title : video.videoId ? video.title : ''}
        canRecord={canRecord}
        onRecord={manualRecord}
        onStop={finishRecording}
        analyser={mixer.analyser}
        input={{ ok: !!mixer.stream, isMixer: mixer.isMixer, label: mixer.label }}
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
          beep={beep}
          onAlmost={() => {
            // La registrazione parte ~200 ms prima del video: l'inizio della base non si taglia
            recSong.current = { videoId: videoRef.current.videoId, title: videoRef.current.title }
            startedRec.current = recorder.start({
              title: videoRef.current.title,
              videoId: videoRef.current.videoId ?? undefined,
              videoTitle: videoRef.current.title
            })
          }}
          onGo={() => {
            yt.command('play')
            graceUntil.current = performance.now() + 1500
            if (startedRec.current) {
              statusRef.current = 'recording'
              setStatus('recording')
            } else {
              listeningId.current = videoRef.current.videoId
              setStatus('listening')
              toast({ tone: 'error', message: 'Non riesco a registrare: controlla il mixer' })
            }
          }}
          onDone={() => setCountingDown(false)}
          onCancel={() => {
            setCountingDown(false)
            yt.command('release')
            setStatus('ready')
          }}
        />
      )}

      {confirm && (
        <Dialog
          title={confirm === 'back' ? 'Vuoi fermare la registrazione?' : 'Vuoi salvare la registrazione?'}
          icon={<Save className="t-accent-ink" />}
          onClose={() => {
            // Indietro: per "cambio canzone" salviamo (la scelta più sicura), altrimenti si continua
            if (confirm === 'newVideo') confirmSave()
            else setConfirm(null)
          }}
          width="lg"
          actions={
            confirm === 'back' ? (
              <>
                <Button
                  variant="danger"
                  icon={<Square className="fill-current" />}
                  onClick={() => {
                    setConfirm(null)
                    finishRecording()
                  }}
                  className="min-w-[20rem]"
                >
                  Sì, ferma e salva
                </Button>
                <Button variant="neutral" icon={<Play />} autoFocusNav onClick={() => setConfirm(null)} className="min-w-[20rem]">
                  No, continua
                </Button>
              </>
            ) : (
              <>
                <Button variant="success" icon={<Save />} autoFocusNav onClick={confirmSave} className="min-w-[18rem]">
                  Sì, salva
                </Button>
                <Button variant="neutral" icon={<Trash2 />} onClick={confirmDiscard} className="min-w-[18rem]">
                  No
                </Button>
              </>
            )
          }
        >
          {confirm === 'newVideo' ? 'Hai cambiato canzone mentre registravi.' : `Stai registrando «${cleanSongTitle(recSong.current.title)}».`}
        </Dialog>
      )}

      {voice && (
        <VoiceOverlay
          title="Cerca con la voce"
          hint="Dì il titolo della canzone, per esempio «Volare karaoke»"
          confirmLabel="Cerca"
          engine={voiceEngine.current ?? undefined}
          preroll={voice.preroll}
          onClose={() => setVoice(null)}
          onResult={(text) => {
            setVoice(null)
            setStatus('ready')
            yt.search(text)
            toast({ tone: 'success', message: `Cerco «${text}» su YouTube` })
          }}
        />
      )}

      {save && <SaveFlow tempId={save.tempId} defaultName={save.name} durationSec={save.durationSec} onDone={afterSave} />}
    </div>
  )
}
