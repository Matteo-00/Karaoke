import { useCallback, useEffect, useState } from 'react'
import { Disc3 } from 'lucide-react'
import { RemoteKeysProvider } from './navigation/RemoteKeys'
import { focusDefault } from './navigation/spatial'
import { ToastProvider } from './components/Toast'
import { Home } from './screens/Home'
import { ComingSoon } from './screens/ComingSoon'
import { YouTubeScreen } from './screens/YouTubeScreen'
import { useAudioDevices } from './hooks/useAudioDevices'
import { studio } from './lib/api'
import { DAY_NIGHT, LIGHT_THEMES, THEMES, type ThemeId } from '../electron/ipc-types'

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

  const goHome = useCallback(() => setScreen('home'), [])

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
          <YouTubeScreen onHome={goHome} countdownSeconds={countdownSeconds} />
        )}
        {screen === 'recordings' && (
          <ComingSoon
            title="Le mie registrazioni"
            icon={<Disc3 className="t-accent-ink" />}
            phase="fase 5"
            onHome={goHome}
          />
        )}
      </RemoteKeysProvider>
    </ToastProvider>
  )
}
