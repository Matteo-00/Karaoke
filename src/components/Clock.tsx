import { useEffect, useState } from 'react'

const timeFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Orologio grande con ora e data in italiano */
export function Clock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    // Si allinea al cambio di minuto, poi aggiorna ogni secondo (costo trascurabile)
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (compact) {
    return <div className="text-[1.75rem] font-extrabold tabular-nums text-white/90">{timeFmt.format(now)}</div>
  }
  return (
    <div className="flex flex-col items-center leading-none">
      <div className="text-[4rem] font-black tracking-tight tabular-nums drop-shadow-[0_0.2rem_1.2rem_rgba(167,139,250,0.55)]">
        {timeFmt.format(now)}
      </div>
      <div className="mt-2 text-[1.5rem] font-bold text-stage-300">{capitalize(dateFmt.format(now))}</div>
    </div>
  )
}
