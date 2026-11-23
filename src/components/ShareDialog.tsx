import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Loader2, RefreshCw, Smartphone, Usb, Wifi } from 'lucide-react'
import type { PhoneShare, Recording, UsbDrive } from '../../electron/ipc-types'
import { Dialog } from './Dialog'
import { Button } from './Button'
import { useBackHandler } from '../navigation/RemoteKeys'
import { focusDefault } from '../navigation/spatial'
import { pushOverlay } from '../lib/overlays'
import { studio } from '../lib/api'
import { songsCount } from '../lib/text'

type Step = 'choose' | 'phone' | 'usb'

/**
 * "Condividi": manda le canzoni scelte
 * - sul telefono, senza fili (QR code da inquadrare con la fotocamera)
 * - su una chiavetta USB
 */
export function ShareDialog({ recordings, onClose }: { recordings: Recording[]; onClose: () => void }) {
  const [step, setStep] = useState<Step>('choose')
  const what = recordings.length === 1 ? `«${recordings[0].title}»` : songsCount(recordings.length)

  if (step === 'phone') return <PhoneStep recordings={recordings} onClose={onClose} />
  if (step === 'usb') return <UsbStep recordings={recordings} onBack={() => setStep('choose')} onClose={onClose} />

  return (
    <Dialog title={recordings.length === 1 ? 'Dove la vuoi mandare?' : 'Dove le vuoi mandare?'} width="lg" onClose={onClose}>
      <div className="mb-6">{what}</div>
      <div className="grid grid-cols-2 gap-6">
        <BigChoice
          autoFocus
          icon={<Smartphone />}
          title="Sul telefono"
          text="Senza fili, con la fotocamera"
          onClick={() => setStep('phone')}
        />
        <BigChoice icon={<Usb />} title="Su una chiavetta" text="Chiavetta USB nel mini PC" onClick={() => setStep('usb')} />
      </div>
    </Dialog>
  )
}

function BigChoice({
  icon,
  title,
  text,
  autoFocus,
  onClick
}: {
  icon: React.ReactNode
  title: string
  text: string
  autoFocus?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-nav=""
      data-autofocus={autoFocus ? '' : undefined}
      onClick={onClick}
      className="t-card2 flex h-[15rem] flex-col items-center justify-center gap-3 rounded-[1.8rem] border-2 px-5"
    >
      <span className="[&>svg]:size-[4.5rem]">{icon}</span>
      <span className="text-[2.2rem] font-black">{title}</span>
      <span className="text-[1.3rem] leading-tight font-bold opacity-85">{text}</span>
    </button>
  )
}

// ------------------------------------------------------------ telefono

function PhoneStep({ recordings, onClose }: { recordings: Recording[]; onClose: () => void }) {
  const [share, setShare] = useState<PhoneShare | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set())

  useEffect(() => pushOverlay(), [])
  useEffect(() => {
    let alive = true
    studio.share
      .startPhone(recordings.map((r) => r.id))
      .then((s) => alive && setShare(s))
      .catch((e: Error) => alive && setError(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')))
    const off = studio.share.onDownloaded((id) => setDownloaded((d) => new Set(d).add(id)))
    return () => {
      alive = false
      off()
      studio.share.stopPhone()
    }
  }, [recordings])

  useBackHandler(() => {
    onClose()
  })
  useEffect(() => {
    requestAnimationFrame(() => focusDefault())
  }, [share, error])

  const done = downloaded.size
  return createPortal(
    <div data-nav-scope="" className="t-bg anim-fade fixed inset-0 z-50 flex items-center justify-center gap-[4rem] px-[4rem]">
      {/* QR code */}
      <div className="flex w-[30rem] shrink-0 flex-col items-center gap-4">
        <div className="flex size-[30rem] items-center justify-center rounded-[2rem] bg-white p-5 shadow-2xl">
          {share ? (
            <img src={share.qr} alt="Codice QR" className="size-full [image-rendering:pixelated]" />
          ) : error ? (
            <Wifi className="size-[8rem] text-[#9aa5b8]" />
          ) : (
            <Loader2 className="size-[6rem] animate-spin text-[#9aa5b8]" />
          )}
        </div>
        {share && <div className="t-muted text-center text-[1.15rem] font-bold break-all">{share.url}</div>}
      </div>

      {/* Istruzioni */}
      <div className="flex max-w-[44rem] flex-col gap-6">
        <h2 className="text-[3rem] leading-tight font-black">Manda sul telefono</h2>
        {error ? (
          <div className="t-warn rounded-[1.2rem] border-2 px-6 py-4 text-[1.7rem] font-extrabold">{error}</div>
        ) : (
          <ol className="flex flex-col gap-5 text-[1.8rem] font-bold">
            <Step n={1}>Prendi il telefono, collegato al <b>Wi‑Fi di casa</b>.</Step>
            <Step n={2}>Apri la <b>fotocamera</b> e inquadra il quadrato.</Step>
            <Step n={3}>Tocca il link che compare, poi <b>«Scarica»</b>.</Step>
          </ol>
        )}
        <div className="t-surface flex items-center gap-4 rounded-[1.2rem] border-2 px-6 py-4 text-[1.6rem] font-extrabold">
          {done > 0 ? <CheckCircle2 className="size-[2.2rem] shrink-0 text-ok" /> : <Smartphone className="t-muted size-[2.2rem] shrink-0" />}
          {done > 0
            ? `Scaricate sul telefono: ${done} su ${recordings.length}`
            : `${songsCount(recordings.length)} pronte da scaricare`}
        </div>
        <div>
          <Button variant={done >= recordings.length ? 'success' : 'neutral'} autoFocusNav onClick={onClose}>
            {done >= recordings.length ? 'Fatto!' : 'Chiudi'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4">
      <span className="t-btn-accent flex size-[3rem] shrink-0 items-center justify-center rounded-full text-[1.6rem] font-black">{n}</span>
      <span className="pt-[0.2rem] [&_b]:font-black" style={{ color: 'var(--text)' }}>
        {children}
      </span>
    </li>
  )
}

// ------------------------------------------------------------ chiavetta

function UsbStep({ recordings, onBack, onClose }: { recordings: Recording[]; onBack: () => void; onClose: () => void }) {
  const [drives, setDrives] = useState<UsbDrive[] | null>(null)
  const [copying, setCopying] = useState<UsbDrive | null>(null)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  // Ricontrolla ogni 2 secondi: appena si inserisce la chiavetta, compare
  useEffect(() => {
    if (copying || result) return
    let alive = true
    const check = () => studio.share.listUsb().then((d) => alive && setDrives(d))
    check()
    const id = window.setInterval(check, 2000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [copying, result])

  // Appena compare la chiavetta il focus passa su "Copia" (OK = copia subito)
  const hasDrives = !!drives?.length
  useEffect(() => {
    requestAnimationFrame(() => focusDefault())
  }, [hasDrives])

  const copy = async (d: UsbDrive) => {
    setCopying(d)
    try {
      const n = await studio.share.copyToUsb(
        recordings.map((r) => r.id),
        d.path
      )
      setResult({ ok: true, text: `Fatto! ${songsCount(n)} nella chiavetta, cartella «Studio Karaoke». Ora puoi toglierla.` })
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
    } finally {
      setCopying(null)
    }
  }

  if (result) {
    return (
      <Dialog
        title={result.ok ? 'Copiate!' : 'Non ci sono riuscito'}
        icon={result.ok ? <CheckCircle2 className="text-ok" /> : <Usb className="text-rec" />}
        onClose={onClose}
        actions={
          <Button variant={result.ok ? 'success' : 'neutral'} autoFocusNav onClick={result.ok ? onClose : () => setResult(null)}>
            {result.ok ? 'OK' : 'Riprova'}
          </Button>
        }
      >
        {result.text}
      </Dialog>
    )
  }
  if (copying) {
    return (
      <Dialog title="Sto copiando…" icon={<Loader2 className="t-accent-ink animate-spin" />} onClose={() => undefined}>
        Non togliere la chiavetta 🙂
      </Dialog>
    )
  }
  return (
    <Dialog
      title={drives?.length ? 'Su quale chiavetta?' : 'Inserisci la chiavetta'}
      icon={<Usb className="t-accent-ink" />}
      width="lg"
      onClose={onBack}
      actions={
        <Button variant="neutral" onClick={onBack} autoFocusNav={!drives?.length}>
          Indietro
        </Button>
      }
    >
      {drives === null ? (
        <Loader2 className="mx-auto size-[3rem] animate-spin" />
      ) : drives.length === 0 ? (
        <div className="flex flex-col items-center gap-4">
          <span>Mettila in una presa USB del mini PC: la vedrò da solo.</span>
          <span className="t-muted flex items-center gap-2 text-[1.4rem]">
            <RefreshCw className="size-[1.6rem] animate-spin [animation-duration:3s]" /> Sto aspettando…
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {drives.map((d, i) => (
            <Button key={d.path} variant="accent" icon={<Usb />} autoFocusNav={i === 0} onClick={() => copy(d)}>
              Copia su «{d.label}»
            </Button>
          ))}
        </div>
      )}
    </Dialog>
  )
}
