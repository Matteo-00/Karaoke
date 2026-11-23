import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { focusDefault } from '../navigation/spatial'
import { useBackHandler } from '../navigation/RemoteKeys'

interface Props {
  title: ReactNode
  icon?: ReactNode
  children?: ReactNode
  /** Pulsanti in fondo al dialog */
  actions?: ReactNode
  /** Chiamato con il tasto Indietro */
  onClose: () => void
  tone?: 'default' | 'danger' | 'warn'
  width?: 'md' | 'lg'
}

const tones = {
  default: 'from-[#2a1d6e] to-[#160f45] border-stage-300/30',
  danger: 'from-[#4a1430] to-[#1d0b2c] border-rec/40',
  warn: 'from-[#4a3a10] to-[#1d160b] border-warn/40'
}

/**
 * Dialog modale grande e centrato.
 * Intrappola il focus (è lo scope di navigazione attivo), parte dal pulsante
 * marcato `autoFocusNav` e al termine restituisce il focus a chi l'ha aperto.
 */
export function Dialog({ title, icon, children, actions, onClose, tone = 'default', width = 'md' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useBackHandler(() => {
    onClose()
  })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const id = requestAnimationFrame(() => {
      if (ref.current) focusDefault(ref.current)
    })
    return () => {
      cancelAnimationFrame(id)
      // Restituisce il focus all'elemento che ha aperto il dialog
      requestAnimationFrame(() => {
        if (previous && document.body.contains(previous)) previous.focus()
      })
    }
  }, [])

  return createPortal(
    <div className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-[#05041a]/80 backdrop-blur-sm">
      <div
        ref={ref}
        data-nav-scope=""
        role="dialog"
        aria-modal="true"
        className={`anim-pop flex flex-col items-center gap-8 rounded-[2.25rem] border-2 bg-gradient-to-b px-14 py-12 text-center shadow-2xl shadow-black/60 ${tones[tone]} ${width === 'lg' ? 'w-[68rem]' : 'w-[56rem]'} max-w-[94vw]`}
      >
        {icon && (
          <div className="flex size-[6rem] items-center justify-center rounded-full bg-white/10 [&>svg]:size-[3.4rem]">
            {icon}
          </div>
        )}
        <h2 className="text-[2.75rem] leading-tight font-black">{title}</h2>
        {children && <div className="text-[1.75rem] leading-snug text-white/85">{children}</div>}
        {actions && <div className="mt-2 flex w-full flex-wrap justify-center gap-6">{actions}</div>}
      </div>
    </div>,
    document.body
  )
}
