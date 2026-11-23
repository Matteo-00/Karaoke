import { Moon, Sun } from 'lucide-react'

/**
 * Pulsante Giorno/Notte accanto a "Esci".
 * Mostra la modalità in cui si passa premendolo (di notte: "Giorno").
 */
export function DayNightButton({ isLight, onToggle }: { isLight: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-nav=""
      data-nav-compact=""
      onClick={onToggle}
      aria-label={isLight ? 'Passa alla versione notte' : 'Passa alla versione giorno'}
      className="t-surface flex h-[6.5rem] w-[7.5rem] flex-col items-center justify-center gap-1 rounded-[1.4rem] border-2 text-[1.4rem] font-extrabold"
    >
      {isLight ? (
        <Moon className="size-[2.6rem] text-[#5b6b8c]" strokeWidth={2.4} />
      ) : (
        <Sun className="size-[2.8rem] text-[#ffc94d]" strokeWidth={2.4} />
      )}
      {isLight ? 'Notte' : 'Giorno'}
    </button>
  )
}
