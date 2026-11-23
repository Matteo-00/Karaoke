import { useState } from 'react'
import { Power, PowerOff, LogOut, Undo2 } from 'lucide-react'
import { Dialog } from './Dialog'
import { Button } from './Button'
import { studio } from '../lib/api'
import { useToast } from './Toast'

/**
 * Icona "Esci" in alto a destra. Apre un dialog con:
 * Spegni il PC · Chiudi l'app · Annulla (focus predefinito, la scelta sicura).
 */
export function ExitButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [shuttingDown, setShuttingDown] = useState(false)
  const toast = useToast()

  const shutdown = async () => {
    setOpen(false)
    setShuttingDown(true)
    const res = await studio.shutdownPc()
    if (!res.ok) {
      setShuttingDown(false)
      toast({ tone: 'error', message: res.message ?? 'Non sono riuscito a spegnere il PC' })
    }
  }

  return (
    <>
      <button
        type="button"
        data-nav=""
        data-nav-compact=""
        onClick={() => setOpen(true)}
        className={`flex flex-col items-center justify-center rounded-[1.4rem] border-2 border-white/20 bg-white/10 font-extrabold ${
          compact ? 'h-[4rem] min-w-[7.5rem] flex-row gap-2 px-4 text-[1.4rem]' : 'h-[6.5rem] w-[7.5rem] gap-1 text-[1.4rem]'
        }`}
        aria-label="Esci"
      >
        <Power className={compact ? 'size-[1.9rem] text-[#ff8095]' : 'size-[2.8rem] text-[#ff8095]'} strokeWidth={2.6} />
        Esci
      </button>

      {open && (
        <Dialog
          title="Vuoi uscire?"
          icon={<Power className="text-[#ff8095]" />}
          onClose={() => setOpen(false)}
          width="lg"
          actions={
            <>
              <Button variant="danger" icon={<PowerOff />} onClick={shutdown} className="min-w-[18rem]">
                Spegni il PC
              </Button>
              <Button variant="accent" icon={<LogOut />} onClick={() => studio.quitApp()} className="min-w-[18rem]">
                Chiudi l'app
              </Button>
              <Button variant="neutral" icon={<Undo2 />} autoFocusNav onClick={() => setOpen(false)} className="min-w-[18rem]">
                Annulla
              </Button>
            </>
          }
        >
          Per tornare a cantare premi <b className="text-white">Annulla</b>.
        </Dialog>
      )}

      {shuttingDown && (
        <div className="anim-fade fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-night-950">
          <PowerOff className="size-[7rem] text-[#ff8095]" />
          <div className="text-[3.5rem] font-black">Sto spegnendo il PC…</div>
          <div className="text-[2rem] text-stage-300">Arrivederci! 👋</div>
        </div>
      )}
    </>
  )
}
