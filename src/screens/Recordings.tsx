import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckSquare,
  ListChecks,
  Share2,
  Square,
  X,
  Disc3,
  Folder,
  FolderInput,
  FolderPlus,
  MonitorPlay,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Star,
  StarOff,
  Timer,
  Trash2,
  Undo2
} from 'lucide-react'
import { DEFAULT_FOLDER, type Recording } from '../../electron/ipc-types'
import { ScreenHeader } from '../components/ScreenHeader'
import { FolderList } from '../components/FolderList'
import { FilterBar } from '../components/FilterBar'
import { RecordingRow } from '../components/RecordingRow'
import { Dialog } from '../components/Dialog'
import { Button } from '../components/Button'
import { OnScreenKeyboard } from '../components/OnScreenKeyboard'
import { FolderPicker } from '../components/FolderPicker'
import { OptionsDialog } from '../components/OptionsDialog'
import { Player } from '../components/Player'
import { ShareDialog } from '../components/ShareDialog'
import { useToast } from '../components/Toast'
import { useBackHandler } from '../navigation/RemoteKeys'
import { useLibrary } from '../hooks/useLibrary'
import { studio } from '../lib/api'
import {
  applyFilters,
  DATE_LABELS,
  DEFAULT_FILTERS,
  DUR_LABELS,
  daysLeft,
  inView,
  isDefault,
  recallFilters,
  rememberFilters,
  summary,
  type DateFilter,
  type DurFilter,
  type Filters,
  type View
} from '../lib/filters'
import { songsCount } from '../lib/text'

type Modal =
  | { t: 'actions'; rec: Recording }
  | { t: 'player'; rec: Recording }
  | { t: 'rename'; rec: Recording }
  | { t: 'move'; rec: Recording }
  | { t: 'delete'; rec: Recording }
  | { t: 'trashActions'; rec: Recording }
  | { t: 'search' }
  | { t: 'date' }
  | { t: 'dur' }
  | { t: 'newFolder'; moveRec?: Recording }
  | { t: 'renameFolder'; folder: string }
  | { t: 'deleteFolder'; folder: string; count: number }
  | { t: 'share'; recs: Recording[] }

/** Vista iniziale ricordata durante la sessione */
let lastView: View = { kind: 'all' }

/** "Le mie registrazioni": cartelle a sinistra, filtri e lista a destra */
export function Recordings({ onHome, onOpenYouTube }: { onHome: () => void; onOpenYouTube: () => void }) {
  const toast = useToast()
  const lib = useLibrary()
  const [view, setViewState] = useState<View>(lastView)
  const [filters, setFiltersState] = useState<Filters>(() => recallFilters(lastView))
  const [modal, setModal] = useState<Modal | null>(null)
  const [draft, setDraft] = useState('')
  /** Modalità "seleziona più canzoni" (per condividerle) */
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useBackHandler(() => {
    if (selecting) {
      setSelecting(false)
      setSelected(new Set())
    } else onHome()
  })

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  // Se la cartella aperta non esiste più (rinominata o eliminata) torniamo a "Tutte"
  useEffect(() => {
    if (lib.loaded && view.kind === 'folder' && !lib.folders.includes(view.folder)) setView({ kind: 'all' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib.folders, lib.loaded])

  const setView = (v: View) => {
    setSelecting(false)
    setSelected(new Set())
    lastView = v
    setViewState(v)
    setFiltersState(recallFilters(v))
  }
  const setFilters = (f: Filters) => {
    rememberFilters(view, f)
    setFiltersState(f)
  }

  // ------------------------------------------------ dati
  const counts = useMemo(() => {
    const byFolder: Record<string, number> = {}
    for (const r of lib.recordings) byFolder[r.folder] = (byFolder[r.folder] ?? 0) + 1
    return {
      all: inView(lib.recordings, { kind: 'all' }).length,
      favorites: inView(lib.recordings, { kind: 'favorites' }).length,
      recent: inView(lib.recordings, { kind: 'recent' }).length,
      trash: inView(lib.recordings, { kind: 'trash' }).length,
      byFolder
    }
  }, [lib.recordings])

  const base = useMemo(() => inView(lib.recordings, view), [lib.recordings, view])
  const list = useMemo(() => applyFilters(base, filters), [base, filters])
  const isTrash = view.kind === 'trash'
  const isGlobal = view.kind === 'all' || view.kind === 'favorites' || view.kind === 'recent'
  const isUserFolder = view.kind === 'folder' && view.folder !== DEFAULT_FOLDER

  const viewTitle =
    view.kind === 'all'
      ? 'Tutte le registrazioni'
      : view.kind === 'favorites'
        ? 'Preferite'
        : view.kind === 'recent'
          ? 'Recenti (ultimi 7 giorni)'
          : view.kind === 'trash'
            ? 'Registrazioni eliminate'
            : view.folder

  // ------------------------------------------------ azioni
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn()
      if (ok) toast({ tone: 'success', message: ok })
    } catch (err) {
      toast({ tone: 'error', message: (err as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
    }
  }

  const removeRec = async (rec: Recording) => {
    setModal(null)
    await run(() => studio.library.remove(rec.id))
    toast({
      tone: 'info',
      message: 'Spostata in «Registrazioni eliminate». Puoi recuperarla per 14 giorni.',
      actionLabel: 'Annulla',
      onAction: () => run(() => studio.library.restore(rec.id), 'Recuperata ✔')
    })
  }

  const nameSort = () =>
    setFilters({ ...filters, sort: filters.sort === 'name-asc' ? 'name-desc' : 'name-asc' })

  // ------------------------------------------------ interfaccia
  return (
    <div className="anim-screen relative z-10 flex h-full flex-col">
      <ScreenHeader title="Le mie registrazioni" icon={<Disc3 className="t-accent-ink" />} onHome={onHome} />

      <div className="flex min-h-0 flex-1">
        {/* Colonna sinistra: cartelle */}
        <aside className="t-header w-[30%] shrink-0 border-r-2">
          <FolderList
            folders={lib.folders}
            counts={counts}
            view={view}
            onSelect={setView}
            onNewFolder={() => {
              setDraft('')
              setModal({ t: 'newFolder' })
            }}
          />
        </aside>

        {/* Area destra: filtri e lista */}
        <section className="flex min-w-0 flex-1 flex-col gap-4 px-6 pt-5">
          <div className="flex items-center gap-4">
            <h2 className="min-w-0 flex-1 truncate text-[2.3rem] font-black">{viewTitle}</h2>
            {!isTrash && !selecting && base.length > 0 && (
              <Button size="md" variant="neutral" icon={<ListChecks />} onClick={() => setSelecting(true)}>
                Seleziona
              </Button>
            )}
            {isUserFolder && view.kind === 'folder' && !selecting && (
              <>
                <Button
                  size="md"
                  variant="neutral"
                  icon={<Pencil />}
                  onClick={() => {
                    setDraft(view.folder)
                    setModal({ t: 'renameFolder', folder: view.folder })
                  }}
                >
                  Rinomina
                </Button>
                <Button
                  size="md"
                  variant="neutral"
                  icon={<Trash2 />}
                  onClick={() => setModal({ t: 'deleteFolder', folder: view.folder, count: counts.byFolder[view.folder] ?? 0 })}
                >
                  Elimina cartella
                </Button>
              </>
            )}
          </div>

          {isTrash ? (
            <div className="t-warn rounded-[1.1rem] border-2 px-5 py-3 text-[1.45rem] font-extrabold">
              Le registrazioni qui vengono cancellate per sempre dopo 14 giorni.
            </div>
          ) : selecting ? (
            <div className="t-surface flex items-center gap-3 rounded-[1.3rem] border-2 px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-[1.6rem] font-black">
                {selected.size === 0 ? 'Scegli' : selected.size === 1 ? '1 scelta' : `${selected.size} scelte`}
              </span>
              <Button size="md" variant="neutral" icon={<CheckSquare />} onClick={() => setSelected(new Set(list.map((r) => r.id)))}>
                Tutte
              </Button>
              <Button size="md" variant="neutral" icon={<Square />} onClick={() => setSelected(new Set())}>
                Nessuna
              </Button>
              <Button
                size="md"
                variant="accent"
                icon={<Share2 />}
                disabled={selected.size === 0}
                onClick={() => setModal({ t: 'share', recs: lib.recordings.filter((r) => selected.has(r.id)) })}
              >
                Condividi
              </Button>
              <Button
                size="md"
                variant="ghost"
                icon={<X />}
                onClick={() => {
                  setSelecting(false)
                  setSelected(new Set())
                }}
              >
                Fine
              </Button>
            </div>
          ) : (
            base.length > 0 && (
              <>
                <FilterBar
                  filters={filters}
                  onSearch={() => setModal({ t: 'search' })}
                  onClearSearch={() => setFilters({ ...filters, search: '' })}
                  onDate={() => setModal({ t: 'date' })}
                  onDuration={() => setModal({ t: 'dur' })}
                  onName={nameSort}
                />
                <div className="flex items-center gap-4">
                  <span className="t-muted flex-1 truncate text-[1.4rem] font-bold">{summary(list.length, filters)}</span>
                  {!isDefault(filters) && (
                    <button
                      type="button"
                      data-nav=""
                      data-nav-compact=""
                      onClick={() => setFilters(DEFAULT_FILTERS)}
                      className="t-btn-neutral flex h-[3.4rem] items-center gap-2 rounded-full border-2 px-5 text-[1.35rem] font-extrabold"
                    >
                      <RotateCcw className="size-[1.6rem]" /> Azzera filtri
                    </button>
                  )}
                </div>
              </>
            )
          )}

          {/* Lista */}
          <div className="-mx-4 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-2 pb-6">
            {list.length > 0 ? (
              <div className="flex flex-col gap-3">
                {list.map((r) => (
                  <RecordingRow
                    key={r.id}
                    recording={r}
                    showFolder={isGlobal}
                    daysLeft={isTrash ? daysLeft(r) : undefined}
                    selected={selecting ? selected.has(r.id) : undefined}
                    onOpen={() =>
                      selecting ? toggle(r.id) : setModal(isTrash ? { t: 'trashActions', rec: r } : { t: 'actions', rec: r })
                    }
                  />
                ))}
              </div>
            ) : base.length > 0 ? (
              <div className="flex flex-col items-center gap-5 pt-12 text-center">
                <Search className="t-muted size-[4.5rem]" />
                <div className="text-[2rem] font-black">Nessuna canzone con questi filtri</div>
                <Button variant="accent" icon={<RotateCcw />} onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Azzera filtri
                </Button>
              </div>
            ) : lib.loaded ? (
              <div className="flex flex-col items-center gap-5 pt-12 text-center">
                <Disc3 className="t-muted size-[5rem]" strokeWidth={1.5} />
                <div className="max-w-[40rem] text-[2rem] font-black">
                  {isTrash
                    ? 'Qui non c’è niente. Meglio così! 😊'
                    : view.kind === 'favorites'
                      ? 'Nessuna preferita. Apri una canzone e premi ⭐'
                      : 'Qui non c’è ancora nessuna canzone. Vai su YouTube e canta! 🎤'}
                </div>
                {!isTrash && view.kind !== 'favorites' && (
                  <Button variant="danger" icon={<MonitorPlay />} onClick={onOpenYouTube}>
                    Vai a YouTube
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------ dialog */}
      {modal?.t === 'actions' && (
        <Dialog title={modal.rec.title} icon={<Disc3 className="t-accent-ink" />} width="lg" onClose={() => setModal(null)}>
          <div className="mb-2">{songsCountLine(modal.rec)}</div>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="accent" icon={<Play className="fill-current" />} autoFocusNav onClick={() => setModal({ t: 'player', rec: modal.rec })}>
              Ascolta
            </Button>
            <Button
              variant="neutral"
              icon={modal.rec.favorite ? <StarOff /> : <Star />}
              onClick={async () => {
                const fav = !modal.rec.favorite
                setModal(null)
                await run(() => studio.library.setFavorite(modal.rec.id, fav), fav ? 'Aggiunta alle preferite ⭐' : 'Tolta dalle preferite')
              }}
            >
              {modal.rec.favorite ? 'Togli dalle preferite' : 'Aggiungi alle preferite'}
            </Button>
            <Button
              variant="neutral"
              icon={<Pencil />}
              onClick={() => {
                setDraft(modal.rec.title)
                setModal({ t: 'rename', rec: modal.rec })
              }}
            >
              Rinomina
            </Button>
            <Button variant="neutral" icon={<FolderInput />} onClick={() => setModal({ t: 'move', rec: modal.rec })}>
              Sposta
            </Button>
            <Button variant="neutral" icon={<Share2 />} onClick={() => setModal({ t: 'share', recs: [modal.rec] })}>
              Condividi
            </Button>
            <Button variant="ghost" icon={<Trash2 />} onClick={() => setModal({ t: 'delete', rec: modal.rec })}>
              Elimina
            </Button>
            <Button variant="ghost" icon={<Undo2 />} onClick={() => setModal(null)}>
              Chiudi
            </Button>
          </div>
        </Dialog>
      )}

      {modal?.t === 'share' && (
        <ShareDialog
          recordings={modal.recs}
          onClose={() => {
            setModal(null)
            setSelecting(false)
            setSelected(new Set())
          }}
        />
      )}

      {modal?.t === 'player' && <Player recording={modal.rec} onClose={() => setModal(null)} />}

      {modal?.t === 'rename' && (
        <Dialog title="Nuovo nome" width="xl" onClose={() => setModal({ t: 'actions', rec: modal.rec })}>
          <OnScreenKeyboard
            value={draft}
            onChange={setDraft}
            okLabel="Salva"
            onOk={async () => {
              setModal(null)
              await run(() => studio.library.rename(modal.rec.id, draft), 'Nome cambiato ✔')
            }}
          />
        </Dialog>
      )}

      {modal?.t === 'move' && (
        <Dialog title="In che cartella la sposto?" width="xl" onClose={() => setModal({ t: 'actions', rec: modal.rec })}>
          <FolderPicker
            folders={lib.folders}
            counts={counts.byFolder}
            current={modal.rec.folder}
            onPick={async (folder) => {
              setModal(null)
              await run(() => studio.library.move(modal.rec.id, folder), `Spostata in «${folder}» ✔`)
            }}
            onNew={() => {
              setDraft('')
              setModal({ t: 'newFolder', moveRec: modal.rec })
            }}
          />
        </Dialog>
      )}

      {modal?.t === 'delete' && (
        <Dialog
          title={`Vuoi eliminare «${modal.rec.title}»?`}
          icon={<Trash2 className="text-rec" />}
          tone="danger"
          onClose={() => setModal({ t: 'actions', rec: modal.rec })}
          actions={
            <>
              <Button variant="danger" icon={<Trash2 />} onClick={() => removeRec(modal.rec)} className="min-w-[14rem]">
                Sì
              </Button>
              <Button variant="neutral" icon={<Undo2 />} autoFocusNav onClick={() => setModal({ t: 'actions', rec: modal.rec })} className="min-w-[14rem]">
                No
              </Button>
            </>
          }
        >
          Potrai recuperarla per 14 giorni.
        </Dialog>
      )}

      {modal?.t === 'trashActions' && (
        <Dialog
          title={modal.rec.title}
          icon={<Trash2 className="t-muted" />}
          width="lg"
          onClose={() => setModal(null)}
          actions={
            <>
              <Button
                variant="success"
                icon={<Undo2 />}
                autoFocusNav
                onClick={async () => {
                  setModal(null)
                  await run(() => studio.library.restore(modal.rec.id), 'Recuperata ✔')
                }}
                className="min-w-[20rem]"
              >
                Ripristina
              </Button>
              <Button variant="accent" icon={<Play className="fill-current" />} onClick={() => setModal({ t: 'player', rec: modal.rec })} className="min-w-[20rem]">
                Ascolta
              </Button>
            </>
          }
        >
          Tornerà nella cartella «{modal.rec.originalFolder ?? DEFAULT_FOLDER}».
        </Dialog>
      )}

      {modal?.t === 'search' && (
        <Dialog title={`Cerca per nome · ${songsCount(list.length)}`} icon={undefined} width="xl" onClose={() => setModal(null)}>
          <OnScreenKeyboard
            value={filters.search}
            onChange={(v) => setFilters({ ...filters, search: v })}
            placeholder="Scrivi una parte del nome"
            okLabel="Mostra"
            onOk={() => setModal(null)}
          />
        </Dialog>
      )}

      {modal?.t === 'date' && (
        <OptionsDialog
          title="Data"
          icon={<CalendarDays className="t-accent-ink" />}
          onClose={() => setModal(null)}
          sections={[
            {
              title: 'Quali canzoni',
              options: (Object.keys(DATE_LABELS) as DateFilter[]).map((d) => ({
                label: DATE_LABELS[d],
                selected: filters.date === d,
                onSelect: () => setFilters({ ...filters, date: d })
              }))
            },
            {
              title: 'In che ordine',
              options: [
                { label: 'Più recenti prima', selected: filters.sort === 'date-desc', onSelect: () => setFilters({ ...filters, sort: 'date-desc' }) },
                { label: 'Più vecchie prima', selected: filters.sort === 'date-asc', onSelect: () => setFilters({ ...filters, sort: 'date-asc' }) }
              ]
            }
          ]}
        />
      )}

      {modal?.t === 'dur' && (
        <OptionsDialog
          title="Durata"
          icon={<Timer className="t-accent-ink" />}
          onClose={() => setModal(null)}
          sections={[
            {
              title: 'Quali canzoni',
              options: (Object.keys(DUR_LABELS) as DurFilter[]).map((d) => ({
                label: DUR_LABELS[d],
                selected: filters.dur === d,
                onSelect: () => setFilters({ ...filters, dur: d })
              }))
            },
            {
              title: 'In che ordine',
              options: [
                { label: 'Più lunghe prima', selected: filters.sort === 'dur-desc', onSelect: () => setFilters({ ...filters, sort: 'dur-desc' }) },
                { label: 'Più corte prima', selected: filters.sort === 'dur-asc', onSelect: () => setFilters({ ...filters, sort: 'dur-asc' }) }
              ]
            }
          ]}
        />
      )}

      {modal?.t === 'newFolder' && (
        <Dialog
          title="Nome della nuova cartella"
          icon={<FolderPlus className="t-accent-ink" />}
          width="xl"
          onClose={() => setModal(modal.moveRec ? { t: 'move', rec: modal.moveRec } : null)}
        >
          <OnScreenKeyboard
            value={draft}
            onChange={setDraft}
            placeholder="Es. Canzoni di Natale"
            okLabel={modal.moveRec ? 'Crea e sposta' : 'Crea'}
            onOk={async () => {
              const rec = modal.moveRec
              setModal(null)
              await run(async () => {
                const name = await studio.library.createFolder(draft)
                if (rec) {
                  await studio.library.move(rec.id, name)
                  toast({ tone: 'success', message: `Spostata in «${name}» ✔` })
                } else {
                  toast({ tone: 'success', message: `Cartella «${name}» creata ✔` })
                  setView({ kind: 'folder', folder: name })
                }
              })
            }}
          />
        </Dialog>
      )}

      {modal?.t === 'renameFolder' && (
        <Dialog title="Nuovo nome della cartella" icon={<Folder className="t-accent-ink" />} width="xl" onClose={() => setModal(null)}>
          <OnScreenKeyboard
            value={draft}
            onChange={setDraft}
            okLabel="Salva"
            onOk={async () => {
              const old = modal.folder
              setModal(null)
              await run(async () => {
                const name = await studio.library.renameFolder(old, draft)
                setView({ kind: 'folder', folder: name })
                toast({ tone: 'success', message: 'Cartella rinominata ✔' })
              })
            }}
          />
        </Dialog>
      )}

      {modal?.t === 'deleteFolder' && (
        <Dialog
          title={`Vuoi eliminare la cartella «${modal.folder}»?`}
          icon={<Trash2 className="text-rec" />}
          tone="danger"
          onClose={() => setModal(null)}
          actions={
            <>
              <Button
                variant="danger"
                icon={<Trash2 />}
                onClick={async () => {
                  const f = modal.folder
                  setModal(null)
                  await run(async () => {
                    const n = await studio.library.deleteFolder(f)
                    setView({ kind: 'all' })
                    toast({ tone: 'info', message: n ? `Cartella eliminata: ${songsCount(n)} in «Registrazioni eliminate»` : 'Cartella eliminata' })
                  })
                }}
                className="min-w-[14rem]"
              >
                Sì
              </Button>
              <Button variant="neutral" icon={<Undo2 />} autoFocusNav onClick={() => setModal(null)} className="min-w-[14rem]">
                No
              </Button>
            </>
          }
        >
          {modal.count > 0
            ? `Contiene ${songsCount(modal.count)}: finiranno in «Registrazioni eliminate» (recuperabili per 14 giorni).`
            : 'La cartella è vuota.'}
        </Dialog>
      )}
    </div>
  )
}

function songsCountLine(r: Recording): string {
  const d = new Date(r.createdAt)
  const when = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
  const m = Math.floor(r.durationSec / 60)
  const s = String(r.durationSec % 60).padStart(2, '0')
  return `Cartella «${r.folder}» · ${when} · ${m}:${s}`
}
