import { Mic } from 'lucide-react'

/** Logo in alto a sinistra: microfono + nome dell'app */
export function AppLogo({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={`flex items-center justify-center rounded-full bg-gradient-to-br from-[#ff4d6a] to-[#7c3aed] shadow-[0_0_1.8rem_rgba(236,72,153,0.55)] ${
          compact ? 'size-[3.2rem]' : 'size-[4.5rem]'
        }`}
      >
        <Mic className={compact ? 'size-[1.8rem]' : 'size-[2.6rem]'} strokeWidth={2.6} />
      </div>
      <div className={`font-black tracking-tight ${compact ? 'text-[1.75rem]' : 'text-[2.4rem]'}`}>{name}</div>
    </div>
  )
}
