import type { ReactNode } from 'react'
import { Disc3, Mic, Play } from 'lucide-react'
import { AppLogo } from '../components/AppLogo'
import { Clock } from '../components/Clock'
import { ExitButton } from '../components/ExitButton'
import { StatusBanner } from '../components/StatusBanner'

interface Props {
  appName: string
  recordingCount: number
  mixerConnected: boolean | null
  onOpenYouTube: () => void
  onOpenRecordings: () => void
}

/** Schermata principale: due riquadri enormi, orologio e pulsante Esci */
export function Home({ appName, recordingCount, mixerConnected, onOpenYouTube, onOpenRecordings }: Props) {
  const countText =
    recordingCount === 0
      ? 'Ancora nessuna canzone'
      : recordingCount === 1
        ? '1 canzone registrata'
        : `${recordingCount} canzoni registrate`

  return (
    <div className="anim-screen relative z-10 flex h-full flex-col px-[3rem] pt-[2rem] pb-[1.75rem]">
      {/* Fascia alta: logo · orologio · esci */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center">
        <AppLogo name={appName} />
        <Clock />
        <div className="flex justify-end">
          <ExitButton />
        </div>
      </header>

      {/* Centro: i due riquadri */}
      <main className="flex flex-1 items-center justify-center gap-[3.5rem]">
        <HomeCard
          autoFocus
          onClick={onOpenYouTube}
          tone="t-card1"
          icon={
            <div className="relative">
              <Play className="size-[5.5rem] translate-x-[0.4rem] fill-current" strokeWidth={0} />
              <span className="t-badge absolute -right-[2.6rem] -bottom-[1.6rem] flex size-[3.6rem] items-center justify-center rounded-full border-[0.25rem]">
                <Mic className="size-[2rem]" strokeWidth={2.8} />
              </span>
            </div>
          }
          title="YouTube – Canta"
          subtitle="Cerca una canzone e canta"
        />
        <HomeCard
          onClick={onOpenRecordings}
          tone="t-card2"
          icon={<Disc3 className="size-[6.2rem]" strokeWidth={1.8} />}
          title="Le mie registrazioni"
          subtitle={countText}
        />
      </main>

      <footer className="flex min-h-[5rem] items-center justify-center">
        <StatusBanner mixerConnected={mixerConnected} />
      </footer>
    </div>
  )
}

function HomeCard({
  icon,
  title,
  subtitle,
  tone,
  autoFocus,
  onClick
}: {
  icon: ReactNode
  title: string
  subtitle: string
  /** Classe del tema: t-card1 o t-card2 */
  tone: string
  autoFocus?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-nav=""
      data-autofocus={autoFocus ? '' : undefined}
      onClick={onClick}
      className={`group relative flex h-[26rem] w-[33rem] flex-col items-center justify-center gap-7 overflow-hidden rounded-[2.5rem] border-[0.2rem] ${tone}`}
    >
      {/* Riflesso lucido in alto */}
      <span className="t-gloss pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" />
      <span className="t-gloss pointer-events-none absolute -top-[6rem] -right-[6rem] size-[16rem] rounded-full bg-white/10 blur-2xl" />
      <span className="t-ring relative flex size-[11rem] items-center justify-center rounded-full border-[0.2rem]">
        {icon}
      </span>
      <span className="relative flex flex-col items-center gap-2">
        <span className="text-[2.9rem] leading-none font-black">{title}</span>
        <span className="text-[1.6rem] font-bold opacity-85">{subtitle}</span>
      </span>
    </button>
  )
}
