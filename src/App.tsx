import { useCallback, useEffect, useRef, useState } from 'react'
import { LifeBuoy, Save, Trash2 } from 'lucide-react'
import { RemoteKeysProvider } from './navigation/RemoteKeys'
import { focusDefault } from './navigation/spatial'
import { ToastProvider } from './components/Toast'
import { Home } from './screens/Home'
import { Recordings } from './screens/Recordings'
import { Dialog } from './components/Dialog'
import { Button } from './components/Button'
import { SaveFlow } from './components/SaveFlow'
import { useToast } from './components/Toast'
import { YouTubeScreen } from './screens/YouTubeScreen'
import { useAudioDevices } from './hooks/useAudioDevices'
import { studio } from './lib/api'
import { DAY_NIGHT, LIGHT_THEMES, THEMES, type TempRecording, type ThemeId } from '../electron/ipc-types'
import { cleanSongTitle, defaultRecordingName, duration } from './lib/text'

/** Tema iniziale; in anteprima si può forzare con ?tema=nome */
function forcedTheme(): ThemeId | null {
  const forced = new URLSearchParams(location.search).get('tema') as ThemeId | null
  return forced && THEMES.includes(forced) ? forced : null
}

export type Screen = 'home' | 'youtube' | 'recordings'

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    // Anteprima nel browser: ?schermata=youtube
    const s = new URLSearchParams(location.search).get('schermata')
    return s === 'youtube' || s === 'recordings' ? s : 'home'
  })
  const [appName, setAppName] = useState('Studio Karaoke')
  const [recordingCount, setRecordingCount] = useState(0)
  const [countdownSeconds, setCountdownSeconds] = useState(5)
  const [theme, setTheme] = useState<ThemeId>(() => forcedTheme() ?? 'ardesia')
  const { mixerConnected } = useAudioDevices()

  useEffect(() => {
    studio.getInfo().then((info) => {
      setAppName(info.appName)
      setCountdownSeconds(info.countdownSeconds)
      if (!forcedTheme()) setTheme(info.theme)
    })
  }, [])

  useEffect(() => {
    if (screen === 'home') studio.getRecordingCount().then(setRecordingCount)
    // Ad ogni cambio schermata il focus va sull'elemento predefinito
    const id = requestAnimationFrame(() => focusDefault())
    return () => cancelAnimationFrame(id)
  }, [screen])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  /** La schermata attiva può bloccare l'uscita (es. registrazione in corso) */
  const leaveGuard = useRef<(() => boolean) | null>(null)
  const setLeaveGuard = useCallback((g: (() => boolean) | null) => {
    leaveGuard.current = g
  }, [])
  /** Torna alla Home senza chiedere (la schermata ha già deciso) */
  const forceHome = useCallback(() => setScreen('home'), [])
  /** Tasto Home del telecomando: prima chiede alla schermata attiva */
  const goHome = useCallback(() => {
    if (leaveGuard.current?.()) return
    setScreen('home')
  }, [])

  const partner = DAY_NIGHT[theme]
  const toggleDayNight = useCallback(() => {
    if (!partner) return
    const apply = () => {
      document.documentElement.dataset.theme = partner
      setTheme(partner)
    }
    // Dissolvenza morbida tra i due temi, se disponibile
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
    if (doc.startViewTransition) doc.startViewTransition(apply)
    else apply()
    studio.setTheme(partner)
  }, [partner])

  return (
    <ToastProvider>
      <RemoteKeysProvider onHome={goHome}>
        <div className="stage-lights" />
        {screen === 'home' && (
          <Home
            appName={appName}
            recordingCount={recordingCount}
            mixerConnected={mixerConnected}
            onOpenYouTube={() => setScreen('youtube')}
            onOpenRecordings={() => setScreen('recordings')}
            isLight={LIGHT_THEMES.includes(theme)}
            onToggleDayNight={partner ? toggleDayNight : undefined}
          />
        )}
        {screen === 'youtube' && (
          <YouTubeScreen onHome={forceHome} countdownSeconds={countdownSeconds} setLeaveGuard={setLeaveGuard} />
        )}
        {screen === 'recordings' && <Recordings onHome={forceHome} onOpenYouTube={() => setScreen('youtube')} />}
        {screen === 'home' && <RecoverOrphans onDone={() => studio.getRecordingCount().then(setRecordingCount)} />}
      </RemoteKeysProvider>
    </ToastProvider>
  )
}

/**
 * All'avvio: se l'app si era chiusa durante una registrazione (crash, corrente
 * staccata…) il file temporaneo è ancora lì e proponiamo di recuperarlo.
 */
function RecoverOrphans({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const [list, setList] = useState<TempRecording[]>([])
  const [saving, setSaving] = useState<TempRecording | null>(null)
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true
    studio.recorder.orphans().then(setList).catch(() => undefined)
  }, [])

  const current = list[0]
  const next = () => {
    setList((l) => l.slice(1))
    onDone()
  }

  if (saving) {
    return (
      <SaveFlow
        tempId={saving.id}
        defaultName={defaultRecordingName(saving.title)}
        durationSec={saving.durationSec}
        onDone={() => {
          setSaving(null)
          next()
        }}
      />
    )
  }
  if (!current) return null
  return (
    <Dialog
      title="C'è una registrazione non salvata"
      icon={<LifeBuoy className="t-accent-ink" />}
      onClose={() => undefined}
      width="lg"
      actions={
        <>
          <Button variant="success" icon={<Save />} autoFocusNav onClick={() => setSaving(current)} className="min-w-[20rem]">
            Sì, recuperala
          </Button>
          <Button
            variant="neutral"
            icon={<Trash2 />}
            onClick={async () => {
              await studio.library.discardTemp(current.id).catch(() => undefined)
              toast({ tone: 'info', message: 'La trovi in «Registrazioni eliminate» per 14 giorni' })
              next()
            }}
            className="min-w-[20rem]"
          >
            No
          </Button>
        </>
      }
    >
      «{cleanSongTitle(current.title || 'Registrazione')}» ({duration(current.durationSec)}). Vuoi recuperarla?
    </Dialog>
  )
}
