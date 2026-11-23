import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'neutral' | 'danger' | 'success' | 'accent' | 'ghost'

const variants: Record<ButtonVariant, string> = {
  neutral: 'bg-white/12 border-white/25 hover:bg-white/18',
  danger: 'bg-gradient-to-b from-[#ff4d6a] to-[#d61f45] border-[#ff8095]/60',
  success: 'bg-gradient-to-b from-[#2ee06e] to-[#16a34a] border-[#86efac]/60',
  accent: 'bg-gradient-to-b from-[#8b5cf6] to-[#6d28d9] border-[#c4b5fd]/60',
  ghost: 'bg-transparent border-white/20 hover:bg-white/10'
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
      className={`inline-flex items-center justify-center border-2 font-extrabold text-white shadow-lg shadow-black/30 ${sizing} ${variants[variant]} ${className}`}
      {...rest}
    >
      {icon && <span className="flex shrink-0 items-center [&>svg]:size-[1.15em]">{icon}</span>}
      <span className="leading-tight">{children}</span>
    </button>
  )
}
