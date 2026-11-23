import { useEffect, useState } from 'react'
import { Check, FolderPlus, Loader2, Pencil, Save, Trash2, Undo2 } from 'lucide-react'
import { DEFAULT_FOLDER } from '../../electron/ipc-types'
import { Dialog } from './Dialog'
import { Button } from './Button'
import { OnScreenKeyboard } from './OnScreenKeyboard'
import { FolderPicker } from './FolderPicker'
import { useToast } from './Toast'
import { studio } from '../lib/api'
import { duration } from '../lib/text'

type Step = 'name' | 'keyboard' | 'folder' | 'newFolder' | 'saving' | 'discard'

interface Props {
  tempId: string
  defaultName: string
  durationSec: number
  /** saved=false se la registrazione è stata scartata */
  onDone: (result: { saved: boolean; folder?: string }) => void
}

/**
 * Salvataggio in due passi:
 * 1. Nome (già pronto: di solito basta premere OK)
 * 2. "In che cartella vuoi salvare questa registrazione?"
 */
export function SaveFlow({ tempId, defaultName, durationSec, onDone }: Props) {
  const toast = useToast()
  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState(defaultName)
  const [draft, setDraft] = useState(defaultName)
  const [folderDraft, setFolderDraft] = useState('')
  const [folders, setFolders] = useState<string[]>([DEFAULT_FOLDER])

  useEffect(() => {
    studio.library.get().then((s) => setFolders(s.folders))
  }, [])

  const save = async (folder: string) => {
    setStep('saving')
    try {
      const rec = await studio.library.saveTemp({ tempId, title: name, folder })
      toast({ tone: 'success', message: `Salvato in «${rec.folder}» ✔` })
      onDone({ saved: true, folder: rec.folder })
    } catch (err) {
      toast({ tone: 'error', message: 'Non sono riuscito a salvare. Riprova.' })
      console.error(err)
      setStep('folder')
    }
  }

  const discard = async () => {
    setStep('saving')
    try {
      await studio.library.discardTemp(tempId)
      toast({ tone: 'info', message: 'Scartata: la trovi in «Registrazioni eliminate» per 14 giorni' })
    } catch (err) {
      console.error(err)
    }
    onDone({ saved: false })
  }

  switch (step) {
    case 'name':
      return (
        <Dialog
          title="Come chiamiamo la canzone?"
          icon={<Save className="t-accent-ink" />}
          onClose={() => setStep('discard')}
          width="lg"
          actions={
            <>
              <Button variant="success" icon={<Check strokeWidth={3} />} autoFocusNav onClick={() => setStep('folder')} className="min-w-[17rem]">
                Avanti
              </Button>
              <Button
                variant="neutral"
                icon={<Pencil />}
                onClick={() => {
                  setDraft(name)
                  setStep('keyboard')
                }}
                className="min-w-[17rem]"
              >
                Cambia nome
              </Button>
              <Button variant="ghost" icon={<Trash2 />} onClick={() => setStep('discard')} className="min-w-[17rem]">
                Scarta
              </Button>
            </>
          }
        >
          <div className="t-surface mx-auto max-w-[56rem] rounded-[1.2rem] border-2 px-6 py-4 text-[2.2rem] font-black" style={{ color: 'var(--text)' }}>
            {name}
          </div>
          <div className="mt-3">Durata: {duration(durationSec)}</div>
        </Dialog>
      )

    case 'keyboard':
      return (
        <Dialog title="Scrivi il nome" width="xl" onClose={() => setStep('name')}>
          <OnScreenKeyboard
            value={draft}
            onChange={setDraft}
            placeholder="Nome della canzone"
            dictateHint="Dì il nome della canzone"
            onOk={() => {
              setName(draft.trim() || defaultName)
              setStep('name')
            }}
          />
        </Dialog>
      )

    case 'folder':
      return (
        <Dialog title="In che cartella la salvo?" width="xl" onClose={() => setStep('name')}>
          <FolderPicker
            folders={folders}
            onPick={save}
            onNew={() => {
              setFolderDraft('')
              setStep('newFolder')
            }}
          />
        </Dialog>
      )

    case 'newFolder':
      return (
        <Dialog title="Nome della nuova cartella" icon={<FolderPlus className="t-accent-ink" />} width="xl" onClose={() => setStep('folder')}>
          <OnScreenKeyboard
            value={folderDraft}
            onChange={setFolderDraft}
            placeholder="Es. Canzoni di Natale"
            dictateHint="Dì il nome della cartella"
            okLabel="Crea e salva"
            onOk={async () => {
              const created = await studio.library.createFolder(folderDraft)
              save(created)
            }}
          />
        </Dialog>
      )

    case 'saving':
      return (
        <Dialog title="Sto salvando…" icon={<Loader2 className="t-accent-ink animate-spin" />} onClose={() => undefined}>
          Un attimo di pazienza 🎵
        </Dialog>
      )

    case 'discard':
      return (
        <Dialog
          title="Vuoi scartare la registrazione?"
          icon={<Trash2 className="text-rec" />}
          tone="danger"
          onClose={() => setStep('name')}
          actions={
            <>
              <Button variant="danger" icon={<Trash2 />} onClick={discard} className="min-w-[16rem]">
                Sì, scarta
              </Button>
              <Button variant="neutral" icon={<Undo2 />} autoFocusNav onClick={() => setStep('name')} className="min-w-[16rem]">
                No, tienila
              </Button>
            </>
          }
        >
          Potrai comunque recuperarla per 14 giorni da «Registrazioni eliminate».
        </Dialog>
      )
  }
}
