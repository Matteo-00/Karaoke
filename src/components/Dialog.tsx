import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { focusDefault } from '../navigation/spatial'
import { useBackHandler } from '../navigation/RemoteKeys'
import { pushOverlay } from '../lib/overlays'

interface Props {
  title: ReactNode
  icon?: ReactNode
  children?: ReactNode
  /** Pulsanti in fondo al dialog */
  actions?: ReactNode
  /** Chiamato con il tasto Indietro */
  onClose: () => void
  tone?: 'default' | 'danger' | 'warn'
  width?: 'md' | 'lg' | 'xl'
}

// Colori dal tema; il "tono" cambia solo il colore dell'icona
const tones = {
  default: '',
  danger: '[&_.dialog-icon]:text-rec',
  warn: '[&_.dialog-icon]:text-warn'
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
  // Nota: un dialog senza via di fuga può passare onClose che non fa nulla

  // Segnala che c'è un livello aperto (YouTube si nasconde)
  useEffect(() => pushOverlay(), [])

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
    <div className="t-overlay anim-fade fixed inset-0 z-50 flex items-center justify-center">
      <div
        ref={ref}
        data-nav-scope=""
        role="dialog"
        aria-modal="true"
        className={`anim-pop flex flex-col items-center gap-8 t-dialog rounded-[2.25rem] border-2 px-14 py-12 text-center shadow-2xl shadow-black/30 ${tones[tone]} ${width === 'xl' ? 'w-[80rem] gap-6 px-10 py-8' : width === 'lg' ? 'w-[68rem]' : 'w-[56rem]'} max-w-[94vw]`}
      >
        {icon && (
          <div className="dialog-icon t-btn-neutral flex size-[6rem] items-center justify-center rounded-full [&>svg]:size-[3.4rem]">
            {icon}
          </div>
        )}
        <h2 className="text-[2.75rem] leading-tight font-black">{title}</h2>
        {children && <div className="t-muted text-[1.75rem] leading-snug">{children}</div>}
        {actions && <div className="mt-2 flex w-full flex-wrap justify-center gap-6">{actions}</div>}
      </div>
    </div>,
    document.body
  )
}
