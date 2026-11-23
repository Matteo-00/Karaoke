import type { ReactNode } from 'react'
import { Hammer, House } from 'lucide-react'
import { Button } from '../components/Button'
import { ScreenHeader } from '../components/ScreenHeader'
import { useBackHandler } from '../navigation/RemoteKeys'

/** Segnaposto per le schermate delle fasi successive */
export function ComingSoon({
  title,
  icon,
  phase,
  onHome
}: {
  title: string
  icon: ReactNode
  phase: string
  onHome: () => void
}) {
  useBackHandler(() => {
    onHome()
  })
  return (
    <div className="anim-screen relative z-10 flex h-full flex-col">
      <ScreenHeader title={title} icon={icon} onHome={onHome} />
      <main className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <Hammer className="t-accent-ink size-[6rem]" />
        <div className="text-[3rem] font-black">Ci stiamo lavorando!</div>
        <div className="t-muted max-w-[50rem] text-[1.75rem]">
          Questa schermata arriva nella <b style={{ color: 'var(--text)' }}>{phase}</b>.
        </div>
        <Button variant="accent" icon={<House />} autoFocusNav onClick={onHome}>
          Torna alla Home
        </Button>
      </main>
    </div>
  )
}
