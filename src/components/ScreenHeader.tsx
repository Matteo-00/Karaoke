import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ExitButton } from './ExitButton'
import { Clock } from './Clock'

/** Barra superiore sottile delle schermate interne: ← Home · titolo · ora · Esci */
export function ScreenHeader({ title, icon, onHome }: { title: ReactNode; icon?: ReactNode; onHome: () => void }) {
  return (
    <header className="t-header flex h-[5.5rem] shrink-0 items-center gap-6 border-b-2 px-[1.5rem]">
      <button
        type="button"
        data-nav=""
        data-nav-compact=""
        onClick={onHome}
        className="t-surface flex h-[4rem] items-center gap-3 rounded-[1.2rem] border-2 px-6 text-[1.6rem] font-extrabold"
      >
        <ArrowLeft className="size-[2rem]" strokeWidth={3} />
        Home
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-4 text-[1.9rem] font-black">
        {icon && <span className="shrink-0 [&>svg]:size-[2.2rem]">{icon}</span>}
        <span className="truncate">{title}</span>
      </div>
      <Clock compact />
      <ExitButton compact />
    </header>
  )
}
