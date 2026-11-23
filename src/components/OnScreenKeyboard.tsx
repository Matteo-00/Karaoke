import { useEffect, useState } from 'react'
import { ArrowBigUp, Check, Delete, Eraser, Mic, Space } from 'lucide-react'
import { VoiceOverlay } from './VoiceOverlay'

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', "'"],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
  ['à', 'è', 'é', 'ì', 'ò', 'ù', '!', '?', '(', ')']
]

interface Props {
  value: string
  onChange: (v: string) => void
  onOk: () => void
  okLabel?: string
  placeholder?: string
  /** Mostra il tasto "Detta" (dettatura con la voce); il testo è il suggerimento */
  dictateHint?: string
}

/**
 * Tastiera a schermo grande, QWERTY, navigabile con le frecce del telecomando.
 * Funziona anche con una tastiera fisica, se collegata.
 */
export function OnScreenKeyboard({ value, onChange, onOk, okLabel = 'OK', placeholder, dictateHint }: Props) {
  const [shift, setShift] = useState(false)
  const [dictating, setDictating] = useState(false)
  // Prima lettera e dopo uno spazio: maiuscola automatica
  const autoCap = value.length === 0 || value.endsWith(' ')
  const upper = shift !== autoCap

  const type = (ch: string) => {
    onChange(value + (upper ? ch.toUpperCase() : ch))
    if (shift) setShift(false)
  }
  const backspace = () => onChange(value.slice(0, -1))

  // Tastiera fisica (se presente)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key.length === 1 && e.key !== ' ' ? true : e.key === ' ') {
        if (e.key === ' ' && document.activeElement?.tagName === 'BUTTON') return // Spazio = premi pulsante
        e.preventDefault()
        onChange(value + e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        e.stopPropagation()
        onChange(value.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [value, onChange])

  const key = (label: string, onClick: () => void, extra = '', autofocus = false) => (
    <button
      type="button"
      data-nav=""
      data-nav-compact=""
      data-autofocus={autofocus ? '' : undefined}
      onClick={onClick}
      className={`t-btn-neutral flex h-[4.3rem] items-center justify-center gap-2 rounded-[0.9rem] border-2 text-[1.9rem] font-extrabold ${extra}`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex w-full flex-col gap-4" data-text-entry="">
      {/* Testo scritto */}
      <div className="t-surface flex min-h-[5rem] items-center rounded-[1.2rem] border-2 px-6 text-left text-[2.3rem] font-extrabold">
        <span className="truncate">
          {value || <span className="t-muted font-bold">{placeholder}</span>}
        </span>
        <span className="ml-1 h-[2.6rem] w-[0.25rem] shrink-0 animate-pulse rounded bg-current" />
      </div>

      <div className="grid grid-cols-10 gap-[0.55rem]">
        {ROWS.flat().map((ch) => (
          <div key={ch} className="contents">
            {key(upper ? ch.toUpperCase() : ch, () => type(ch))}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-10 gap-[0.55rem]">
        <button
          type="button"
          data-nav=""
          data-nav-compact=""
          onClick={() => setShift((s) => !s)}
          aria-label="Maiuscole"
          className={`${dictateHint ? 'col-span-1' : 'col-span-2'} flex h-[4.3rem] items-center justify-center gap-2 rounded-[0.9rem] border-2 text-[1.5rem] font-extrabold ${
            shift ? 't-btn-accent' : 't-btn-neutral'
          }`}
        >
          <ArrowBigUp className="size-[1.9rem]" /> {!dictateHint && 'Maiusc'}
        </button>
        <button
          type="button"
          data-nav=""
          data-nav-compact=""
          onClick={() => onChange(value + ' ')}
          className={`t-btn-neutral ${dictateHint ? 'col-span-2' : 'col-span-3'} flex h-[4.3rem] items-center justify-center gap-2 rounded-[0.9rem] border-2 text-[1.5rem] font-extrabold`}
        >
          <Space className="size-[1.9rem]" /> Spazio
        </button>
        <button
          type="button"
          data-nav=""
          data-nav-compact=""
          data-autofocus=""
          onClick={backspace}
          className="t-btn-neutral col-span-2 flex h-[4.3rem] items-center justify-center gap-2 rounded-[0.9rem] border-2 text-[1.5rem] font-extrabold"
        >
          <Delete className="size-[1.9rem]" /> Cancella
        </button>
        <button
          type="button"
          data-nav=""
          data-nav-compact=""
          onClick={() => onChange('')}
          className="t-btn-neutral col-span-1 flex h-[4.3rem] items-center justify-center rounded-[0.9rem] border-2"
          aria-label="Svuota"
          title="Svuota"
        >
          <Eraser className="size-[1.9rem]" />
        </button>
        {dictateHint && (
          <button
            type="button"
            data-nav=""
            data-nav-compact=""
            onClick={() => setDictating(true)}
            className="t-btn-danger col-span-2 flex h-[4.3rem] items-center justify-center gap-2 rounded-[0.9rem] border-2 text-[1.5rem] font-extrabold"
          >
            <Mic className="size-[1.9rem]" strokeWidth={2.6} /> Detta
          </button>
        )}
        <button
          type="button"
          data-nav=""
          data-nav-compact=""
          onClick={onOk}
          disabled={!value.trim()}
          className="t-btn-success col-span-2 flex h-[4.3rem] items-center justify-center gap-2 rounded-[0.9rem] border-2 text-[1.6rem] font-black"
        >
          <Check className="size-[2rem]" strokeWidth={3} /> {okLabel}
        </button>
      </div>

      {dictating && dictateHint && (
        <VoiceOverlay
          title="Detta con la voce"
          hint={dictateHint}
          confirmLabel="Usa questo"
          onClose={() => setDictating(false)}
          onResult={(text) => {
            setDictating(false)
            onChange(text.charAt(0).toUpperCase() + text.slice(1))
          }}
        />
      )}
    </div>
  )
}
