import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react'

type Tone = 'success' | 'info' | 'error'

export interface ToastOptions {
  message: ReactNode
  tone?: Tone
  /** Pulsante opzionale (es. "Annulla" dopo un'eliminazione) */
  actionLabel?: string
  onAction?: () => void
  /** Durata in ms: 3 s di default, 8 s se c'è un'azione */
  durationMs?: number
}

interface ToastState extends ToastOptions {
  id: number
}

const ToastContext = createContext<(t: ToastOptions) => void>(() => {})

export const useToast = () => useContext(ToastContext)

const tones: Record<Tone, { cls: string; icon: ReactNode }> = {
  success: { cls: 'from-[#22c55e] to-[#15803d] border-[#86efac]/70', icon: <CheckCircle2 /> },
  info: { cls: 'from-[#6d5cf6] to-[#4c2fc9] border-[#c4b5fd]/70', icon: <Info /> },
  error: { cls: 'from-[#ef4444] to-[#b91c1c] border-[#fca5a5]/70', icon: <TriangleAlert /> }
}

/** Messaggi brevi in alto al centro: verde "fatto!" per 3 secondi */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((t: ToastOptions) => {
    window.clearTimeout(timer.current)
    const id = Date.now()
    setToast({ ...t, id })
    const ms = t.durationMs ?? (t.onAction ? 8000 : 3000)
    timer.current = window.setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), ms)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const tone = tones[toast?.tone ?? 'success']

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className={`fixed top-[0.6rem] left-1/2 z-[60] flex max-w-[80vw] items-center gap-5 rounded-[1.5rem] border-2 bg-gradient-to-b px-9 py-[0.7rem] text-[1.75rem] font-extrabold whitespace-nowrap shadow-2xl shadow-black/50 [animation:toast-in_240ms_ease-out_both] ${tone.cls}`}
        >
          <span className="[&>svg]:size-[2.2rem]">{tone.icon}</span>
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              type="button"
              data-nav=""
              data-nav-compact=""
              onClick={() => {
                toast.onAction?.()
                setToast(null)
              }}
              className="ml-2 rounded-[1rem] border-2 border-white/60 bg-white/20 px-6 py-2 text-[1.5rem] font-black"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}
