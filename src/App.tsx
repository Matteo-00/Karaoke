import { useCallback, useEffect, useState } from 'react'
import { Disc3, MonitorPlay } from 'lucide-react'
import { RemoteKeysProvider } from './navigation/RemoteKeys'
import { focusDefault } from './navigation/spatial'
import { ToastProvider } from './components/Toast'
import { Home } from './screens/Home'
import { ComingSoon } from './screens/ComingSoon'
import { useAudioDevices } from './hooks/useAudioDevices'
import { studio } from './lib/api'

export type Screen = 'home' | 'youtube' | 'recordings'

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    // Anteprima nel browser: ?schermata=youtube
    const s = new URLSearchParams(location.search).get('schermata')
    return s === 'youtube' || s === 'recordings' ? s : 'home'
  })
  const [appName, setAppName] = useState('Studio Karaoke')
  const [recordingCount, setRecordingCount] = useState(0)
  const { mixerConnected } = useAudioDevices()

  useEffect(() => {
    studio.getInfo().then((info) => setAppName(info.appName))
  }, [])

  useEffect(() => {
    if (screen === 'home') studio.getRecordingCount().then(setRecordingCount)
    // Ad ogni cambio schermata il focus va sull'elemento predefinito
    const id = requestAnimationFrame(() => focusDefault())
    return () => cancelAnimationFrame(id)
  }, [screen])

  const goHome = useCallback(() => setScreen('home'), [])

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
          />
        )}
        {screen === 'youtube' && (
          <ComingSoon
            title="YouTube – Canta"
            icon={<MonitorPlay className="text-rec" />}
            phase="fase 2 (YouTube) e fase 3 (registrazione)"
            onHome={goHome}
          />
        )}
        {screen === 'recordings' && (
          <ComingSoon
            title="Le mie registrazioni"
            icon={<Disc3 className="text-stage-300" />}
            phase="fase 5"
            onHome={goHome}
          />
        )}
      </RemoteKeysProvider>
    </ToastProvider>
  )
}
