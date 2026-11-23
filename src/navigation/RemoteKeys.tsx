/**
 * Gestione centralizzata dei tasti del telecomando.
 *
 * - Frecce: spostano il focus (navigazione spaziale)
 * - OK/Invio: gestito nativamente dai <button>
 * - Indietro (Esc, BrowserBack, Backspace, tasto "indietro" del mouse):
 *   chiama il gestore più recente registrato con useBackHandler
 * - Home (BrowserHome, Home): torna alla Home dell'app
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { focusDefault, focusIsInScope, moveFocus, type Direction } from './spatial'

type Handler = () => boolean | void

interface KeyRegistry {
  pushBack(h: { current: Handler }): () => void
}

const KeyContext = createContext<KeyRegistry | null>(null)

const BACK_KEYS = new Set(['Escape', 'BrowserBack', 'GoBack', 'Backspace'])
const HOME_KEYS = new Set(['BrowserHome', 'Home'])
const ARROWS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right'
}

/** L'ultimo tasto premuto (usato dal tester tasti nelle impostazioni) */
export interface LastKey {
  key: string
  code: string
  keyCode: number
}

function isTextInput(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'range'].includes(el.type)
  return (el as HTMLElement).isContentEditable
}

export function RemoteKeysProvider({
  children,
  onHome,
  onKey
}: {
  children: ReactNode
  onHome: () => void
  onKey?: (k: LastKey) => void
}) {
  const stack = useRef<{ current: Handler }[]>([])
  const onHomeRef = useRef(onHome)
  const onKeyRef = useRef(onKey)
  onHomeRef.current = onHome
  onKeyRef.current = onKey

  useEffect(() => {
    const runBack = () => {
      // Dal gestore più recente al più vecchio: il primo che "consuma" il tasto vince
      for (let i = stack.current.length - 1; i >= 0; i--) {
        if (stack.current[i].current() !== false) return
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      onKeyRef.current?.({ key: e.key, code: e.code, keyCode: e.keyCode })
      const target = document.activeElement

      // Elementi che gestiscono da soli le frecce (es. il player)
      const captures = (target as HTMLElement | null)?.closest?.('[data-nav-capture]')

      if (e.key in ARROWS && !captures) {
        if (isTextInput(target) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return
        e.preventDefault()
        moveFocus(ARROWS[e.key])
        return
      }
      if (BACK_KEYS.has(e.key)) {
        if (e.key === 'Backspace' && isTextInput(target)) return
        // Nella tastiera a schermo Backspace cancella (lo gestisce la tastiera)
        if (e.key === 'Backspace' && document.querySelector('[data-text-entry]')) return
        e.preventDefault()
        runBack()
        return
      }
      if (HOME_KEYS.has(e.key) && !isTextInput(target)) {
        e.preventDefault()
        onHomeRef.current()
        return
      }
      if (e.key === 'Enter' && !focusIsInScope()) {
        // Niente a fuoco: OK riporta il focus all'elemento predefinito
        e.preventDefault()
        focusDefault()
      }
    }

    // Tasto "indietro" laterale del mouse / air mouse
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault()
        runBack()
      }
    }

    // Air mouse: il puntatore che passa sopra un elemento gli dà il focus,
    // così frecce e mouse restano sempre allineati
    const onPointerMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-nav]')
      if (el && el !== document.activeElement && !el.hasAttribute('disabled')) {
        el.focus({ preventScroll: true })
      }
    }

    // Se il focus si perde (elemento rimosso), lo recuperiamo
    const onFocusOut = () => {
      requestAnimationFrame(() => {
        if (document.activeElement === document.body || document.activeElement === null) {
          focusDefault()
        }
      })
    }

    // Quando la finestra dell'interfaccia non ha il focus (es. si sta usando
    // YouTube) nascondiamo il bordo giallo, per non distrarre
    const onWinBlur = () => document.documentElement.setAttribute('data-window-blurred', '')
    const onWinFocus = () => document.documentElement.removeAttribute('data-window-blurred')
    window.addEventListener('blur', onWinBlur)
    window.addEventListener('focus', onWinFocus)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('pointermove', onPointerMove)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      window.removeEventListener('blur', onWinBlur)
      window.removeEventListener('focus', onWinFocus)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  const registry: KeyRegistry = {
    pushBack(h) {
      stack.current.push(h)
      return () => {
        stack.current = stack.current.filter((x) => x !== h)
      }
    }
  }

  return <KeyContext.Provider value={registry}>{children}</KeyContext.Provider>
}

/**
 * Registra un gestore per il tasto "Indietro". Vince il gestore più recente
 * (es. il dialog aperto). Restituire `false` lascia passare il tasto al successivo.
 */
export function useBackHandler(handler: Handler, active = true): void {
  const registry = useContext(KeyContext)
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!registry || !active) return
    return registry.pushBack(ref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
