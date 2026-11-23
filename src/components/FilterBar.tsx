import type { ReactNode } from 'react'
import { ArrowDownAZ, ArrowUpZA, CalendarDays, Search, Timer, X } from 'lucide-react'
import { DATE_LABELS, DUR_LABELS, type Filters } from '../lib/filters'

interface Props {
  filters: Filters
  onSearch: () => void
  onClearSearch: () => void
  onDate: () => void
  onDuration: () => void
  onName: () => void
}

/** Barra filtri: pulsanti grandi (chip) navigabili con le frecce */
export function FilterBar({ filters, onSearch, onClearSearch, onDate, onDuration, onName }: Props) {
  const sortIs = (p: string) => filters.sort.startsWith(p)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Chip icon={<Search />} active={!!filters.search} onClick={onSearch}>
        {filters.search ? `«${filters.search}»` : 'Cerca per nome'}
      </Chip>
      {filters.search && (
        <Chip icon={<X />} onClick={onClearSearch} label="Togli la ricerca">
          {''}
        </Chip>
      )}
      <Chip icon={<CalendarDays />} active={filters.date !== 'all' || sortIs('date')} onClick={onDate}>
        {filters.date === 'all' ? 'Data' : DATE_LABELS[filters.date]}
      </Chip>
      <Chip icon={<Timer />} active={filters.dur !== 'all' || sortIs('dur')} onClick={onDuration}>
        {filters.dur === 'all' ? 'Durata' : DUR_LABELS[filters.dur].split(' (')[0]}
      </Chip>
      <Chip icon={filters.sort === 'name-desc' ? <ArrowUpZA /> : <ArrowDownAZ />} active={sortIs('name')} onClick={onName}>
        {filters.sort === 'name-desc' ? 'Nome Z→A' : 'Nome A→Z'}
      </Chip>
    </div>
  )
}

function Chip({
  icon,
  active,
  onClick,
  children,
  label
}: {
  icon: ReactNode
  active?: boolean
  onClick: () => void
  children: ReactNode
  label?: string
}) {
  return (
    <button
      type="button"
      data-nav=""
      data-nav-compact=""
      onClick={onClick}
      aria-label={label}
      className={`flex h-[3.8rem] max-w-[22rem] items-center gap-2 rounded-full border-2 px-5 text-[1.45rem] font-extrabold ${
        active ? 't-btn-accent' : 't-btn-neutral'
      }`}
    >
      <span className="shrink-0 [&>svg]:size-[1.7rem]">{icon}</span>
      {children ? <span className="truncate">{children}</span> : null}
    </button>
  )
}
