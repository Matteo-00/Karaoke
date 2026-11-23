import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Dialog } from './Dialog'

export interface OptionSection {
  title: string
  options: { label: string; selected: boolean; onSelect: () => void }[]
}

/** Dialog con gruppi di scelte (es. filtro per data + ordinamento) */
export function OptionsDialog({
  title,
  icon,
  sections,
  onClose
}: {
  title: string
  icon?: ReactNode
  sections: OptionSection[]
  onClose: () => void
}) {
  return (
    <Dialog title={title} icon={icon} width="lg" onClose={onClose}>
      <div className="flex flex-col gap-6 text-left">
        {sections.map((s, si) => (
          <div key={s.title}>
            <div className="mb-3 text-[1.4rem] font-black tracking-wide uppercase">{s.title}</div>
            <div className="flex flex-wrap gap-3">
              {s.options.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  data-nav=""
                  data-nav-compact=""
                  data-autofocus={si === 0 && o.selected ? '' : undefined}
                  onClick={o.onSelect}
                  className={`flex h-[4.2rem] items-center gap-2 rounded-full border-2 px-6 text-[1.5rem] font-extrabold ${
                    o.selected ? 't-btn-accent' : 't-btn-neutral'
                  }`}
                >
                  {o.selected && <Check className="size-[1.7rem]" strokeWidth={3} />}
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  )
}
