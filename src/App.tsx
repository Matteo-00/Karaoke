import { useCallback, useEffect, useRef, useState } from 'react'
import { LifeBuoy, Save, Trash2 } from 'lucide-react'
import { RemoteKeysProvider } from './navigation/RemoteKeys'
import { focusDefault } from './navigation/spatial'
import { ToastProvider } from './components/Toast'
import { Home } from './screens/Home'
import { Recordings } from './screens/Recordings'
import { Settings } from './screens/Settings'
import { Dialog } from './components/Dialog'
import { Button } from './components/Button'
import { SaveFlow } from './components/SaveFlow'
import { useToast } from './components/Toast'
import { YouTubeScreen } from './screens/YouTubeScreen'
import { useAudioDevices } from './hooks/useAudioDevices'
import { studio } from './lib/api'
import { DAY_NIGHT, LIGHT_THEMES, THEMES, type StudioSettings, type TempRecording, type ThemeId } from '../electron/ipc-types'
import { cleanSongTitle, defaultRecordingName, duration } from './lib/text'

/** Tema iniziale; in anteprima si può forzare con ?tema=nome */
function forcedTheme(): ThemeId | null {
  const forced = new URLSearchParams(location.search).get('tema') as ThemeId | null
  return forced && THEMES.includes(forced) ? forced : null
}

export type Screen = 'home' | 'youtube' | 'recordings' | 'settings'

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    // Anteprima nel browser: ?schermata=youtube
    const s = new URLSearchParams(location.search).get('schermata')
    return s === 'youtube' || s === 'recordings' || s === 'settings' ? s : 'home'
  })
  const [appName, setAppName] = useState('Studio Karaoke')
  const [recordingCount, setRecordingCount] = useState(0)
  const [countdownSeconds, setCountdownSeconds] = useState(5)
  const [beep, setBeep] = useState(false)
  const [trashDays, setTrashDays] = useState(14)
  const [theme, setTheme] = useState<ThemeId>(() => forcedTheme() ?? 'ardesia')
  const { mixerConnected, outputIsMixer } = useAudioDevices()

  useEffect(() => {
    studio.getInfo().then((info) => {
      setAppName(info.appName)
      setCountdownSeconds(info.countdownSeconds)
      setBeep(info.beep)
      setTrashDays(info.trashDays)
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

  /** Impostazioni nascoste: 3 secondi sul logo in Home (o Ctrl+Shift+S) */
  const openSettings = useCallback(() => setScreen('settings'), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!leaveGuard.current?.()) openSettings()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openSettings])

  /** Le impostazioni cambiate si applicano subito */
  const applySettings = useCallback((s: StudioSettings) => {
    setAppName(s.appName)
    setCountdownSeconds(s.countdownSeconds)
    setBeep(s.beep)
    setTrashDays(s.trashDays)
    setTheme(s.theme)
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
            outputIsMixer={outputIsMixer}
            onLogoLongPress={openSettings}
            onOpenYouTube={() => setScreen('youtube')}
            onOpenRecordings={() => setScreen('recordings')}
            isLight={LIGHT_THEMES.includes(theme)}
            onToggleDayNight={partner ? toggleDayNight : undefined}
          />
        )}
        {screen === 'youtube' && (
          <YouTubeScreen onHome={forceHome} countdownSeconds={countdownSeconds} beep={beep} setLeaveGuard={setLeaveGuard} />
        )}
        {screen === 'recordings' && <Recordings onHome={forceHome} onOpenYouTube={() => setScreen('youtube')} trashDays={trashDays} />}
        {screen === 'settings' && <Settings onHome={forceHome} onChanged={applySettings} />}

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
