import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'neutral' | 'danger' | 'success' | 'accent' | 'ghost'

// I colori vengono dal tema attivo (src/styles/themes.css)
const variants: Record<ButtonVariant, string> = {
  neutral: 't-btn-neutral',
  danger: 't-btn-danger',
  success: 't-btn-success',
  accent: 't-btn-accent',
  ghost: 't-surface bg-transparent'
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode
  variant?: ButtonVariant
  /** Riceve il focus quando si apre la schermata o il dialog */
  autoFocusNav?: boolean
  size?: 'md' | 'lg'
  children: ReactNode
}

/** Pulsante grande, sempre con icona + testo, navigabile col telecomando */
export function Button({
  icon,
  variant = 'neutral',
  autoFocusNav,
  size = 'lg',
  className = '',
  children,
  ...rest
}: Props) {
  const sizing =
    size === 'lg'
      ? 'min-h-[5.5rem] px-8 text-[1.75rem] gap-4 rounded-[1.5rem]'
      : 'min-h-[4rem] px-6 text-[1.5rem] gap-3 rounded-[1.2rem]'
  return (
    <button
      type="button"
      data-nav=""
      data-autofocus={autoFocusNav ? '' : undefined}
      className={`inline-flex items-center justify-center border-2 font-extrabold shadow-md shadow-black/15 ${sizing} ${variants[variant]} ${className}`}
      {...rest}
    >
      {icon && <span className="flex shrink-0 items-center [&>svg]:size-[1.15em]">{icon}</span>}
      <span className="leading-tight">{children}</span>
    </button>
  )
}
