import { useEffect, useState, type ReactNode } from 'react'
import {
  AudioLines,
  Check,
  CircleAlert,
  CircleCheck,
  FolderOpen,
  Info,
  Keyboard,
  LogOut,
  Mic,
  MonitorPlay,
  Palette,
  Pencil,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldCheck,
  Timer
} from 'lucide-react'
import { THEMES, type StudioSettings, type ThemeId, type VoiceStatus } from '../../electron/ipc-types'
import { ScreenHeader } from '../components/ScreenHeader'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { OnScreenKeyboard } from '../components/OnScreenKeyboard'
import { VoiceOverlay } from '../components/VoiceOverlay'
import { VuMeter } from '../components/VuMeter'
import { useToast } from '../components/Toast'
import { useBackHandler } from '../navigation/RemoteKeys'
import { useAudioDevices, findMixer } from '../hooks/useAudioDevices'
import { useDeviceLevel } from '../hooks/useDeviceLevel'
import { studio } from '../lib/api'

const THEME_LABELS: Record<ThemeId, string> = {
  ardesia: 'Ardesia notte',
  'ardesia-giorno': 'Ardesia giorno',
  palco: 'Palco',
  corallo: 'Corallo',
  cielo: 'Cielo',
  salvia: 'Salvia',
  vinile: 'Vinile'
}

type FullSettings = StudioSettings & { version: string; dataRootResolved: string }

/**
 * Impostazioni nascoste (per chi gestisce l'impianto).
 * Si aprono tenendo premuto 3 secondi il logo in Home (OK del telecomando o air mouse),
 * oppure con Ctrl+Shift+S.
 */
export function Settings({ onHome, onChanged }: { onHome: () => void; onChanged: (s: StudioSettings) => void }) {
  const toast = useToast()
  const devices = useAudioDevices()
  const [s, setS] = useState<FullSettings | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [lastKey, setLastKey] = useState<{ key: string; code: string; keyCode: number } | null>(null)
  const [modal, setModal] = useState<null | 'name' | 'restart' | 'voiceTest'>(null)
  /** In attesa del tasto del microfono da imparare */
  const [learning, setLearning] = useState(false)
  const [voiceState, setVoiceState] = useState<VoiceStatus>({ state: 'idle' })
  const [draft, setDraft] = useState('')

  useBackHandler(() => {
    onHome()
  })

  useEffect(() => {
    studio.settings.get().then(setS)
    studio.settings.logs().then(setLogs)
  }, [])

  useEffect(() => {
    studio.voice.status().then(setVoiceState)
    return studio.voice.onStatus(setVoiceState)
  }, [])

  // Tester dei tasti: legge ogni tasto prima della navigazione.
  // In modalità "impara" il tasto premuto diventa quello del microfono.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      setLastKey({ key: e.key, code: e.code, keyCode: e.keyCode })
      if (learning && !['Escape', 'BrowserBack', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        setLearning(false)
        const k = e.key && e.key !== 'Unidentified' ? e.key : e.code
        save({ voiceKey: k }, `Tasto del microfono: ${k} ✔`)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learning])

  const save = async (patch: Partial<StudioSettings>, message = 'Salvato ✔') => {
    const next = await studio.settings.set(patch)
    setS((cur) => (cur ? { ...cur, ...next } : cur))
    onChanged(next)
    toast({ tone: 'success', message })
    studio.settings.logs().then(setLogs)
  }

  // Dispositivi audio
  const inputs = devices.inputs.filter((d) => d.deviceId !== 'default')
  const recDevice = s ? findMixer(inputs, s.mixerLabelHint) : undefined
  const level = useDeviceLevel(recDevice?.deviceId ?? null)

  if (!s) return null

  return (
    <div className="anim-screen relative z-10 flex h-full flex-col">
      <ScreenHeader title="Impostazioni" icon={<SettingsIcon className="t-accent-ink" />} onHome={onHome} />

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-8 pt-6 pb-16">
        <div className="mx-auto flex max-w-[76rem] flex-col gap-6">
          {/* ------------------------------------------------ Audio */}
          <Section icon={<AudioLines />} title="Audio">
            <Row label="Microfono per registrare" hint="L'ingresso del mixer (di solito «USB Audio CODEC»)">
              {inputs.length === 0 ? (
                <span className="t-warn rounded-[1rem] border-2 px-4 py-2 text-[1.4rem] font-bold">Nessun microfono trovato</span>
              ) : (
                <Chips
                  options={inputs.map((d) => ({ value: d.deviceId, label: d.label || 'Microfono senza nome' }))}
                  value={recDevice?.deviceId}
                  onChange={(id) => {
                    const d = inputs.find((x) => x.deviceId === id)
                    if (d) save({ mixerLabelHint: d.label }, 'Microfono scelto ✔')
                  }}
                />
              )}
              <div className="mt-3 flex items-center gap-4">
                <VuMeter analyser={level} className="w-[24rem]" />
                <span className="t-muted text-[1.2rem] font-bold">Parla nel microfono: le barre si devono muovere</span>
              </div>
            </Row>

            <Row label="Uscita audio" hint="Dove va il suono di YouTube: deve essere il mixer">
              {devices.outputIsMixer === null ? (
                <Status ok={null}>Non riesco a leggere l'uscita audio</Status>
              ) : devices.outputIsMixer ? (
                <Status ok>Va al mixer: «{devices.defaultOutputLabel}»</Status>
              ) : (
                <Status ok={false}>
                  Va a «{devices.defaultOutputLabel}». Su Windows: Impostazioni → Sistema → Audio → Output → «USB Audio CODEC»
                </Status>
              )}
            </Row>

            <Row label="Qualità MP3">
              <Chips
                options={[128, 192, 256, 320].map((v) => ({ value: v, label: `${v} kbps${v === 192 ? ' (consigliata)' : ''}` }))}
                value={s.mp3Bitrate}
                onChange={(v) => save({ mp3Bitrate: v })}
              />
            </Row>
          </Section>

          {/* ------------------------------------------------ Voce */}
          <Section icon={<Mic />} title="Voce (ricerca e dettatura)">
            <Row label="Stato" hint="Riconoscimento in locale con Whisper: si scarica una volta sola">
              {voiceState.state === 'ready' ? (
                <Status ok>Pronta</Status>
              ) : voiceState.state === 'loading' ? (
                <Status ok={null}>Sto preparando la voce: {voiceState.progress}%</Status>
              ) : voiceState.state === 'error' ? (
                <Status ok={false}>{voiceState.message}</Status>
              ) : (
                <Status ok={null}>Si prepara da sola pochi secondi dopo l'avvio</Status>
              )}
            </Row>
            <Row label="Microfono per la voce" hint="Quello del telecomando. «Automatico» = un microfono diverso dal mixer">
              <Chips
                options={[{ value: '', label: 'Automatico' }, ...inputs.map((d) => ({ value: d.label, label: d.label || 'Senza nome' }))]}
                value={s.voiceMicLabel}
                onChange={(v) => save({ voiceMicLabel: v })}
              />
            </Row>
            <Row label="Tasto del microfono" hint="Il tasto del telecomando che avvia la ricerca vocale">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[1.6rem] font-black">{s.voiceKey || 'Standard'}</span>
                <Button size="md" variant={learning ? 'accent' : 'neutral'} icon={<Keyboard />} onClick={() => setLearning(true)}>
                  {learning ? 'Premi ora il tasto del microfono…' : 'Imposta tasto'}
                </Button>
                {s.voiceKey && !learning && (
                  <Button size="md" variant="ghost" onClick={() => save({ voiceKey: '' })}>
                    Standard
                  </Button>
                )}
              </div>
            </Row>
            <Row label="Ascolto automatico" hint="Tieni premuto il microfono del telecomando e parla: la ricerca parte da sola">
              <Chips
                options={[
                  { value: true, label: 'Sì' },
                  { value: false, label: 'No' }
                ]}
                value={s.voiceAuto}
                onChange={(v) => save({ voiceAuto: v })}
              />
            </Row>
            <Row label="Prova">
              <Button size="md" variant="danger" icon={<Mic />} onClick={() => setModal('voiceTest')}>
                Prova la voce
              </Button>
            </Row>
          </Section>

          {/* ------------------------------------------------ Registrazione */}
          <Section icon={<Timer />} title="Registrazione">
            <Row label="Conto alla rovescia">
              <Chips
                options={[3, 5, 7, 10].map((v) => ({ value: v, label: `${v} secondi` }))}
                value={s.countdownSeconds}
                onChange={(v) => save({ countdownSeconds: v })}
              />
            </Row>
            <Row label="Bip a ogni numero" hint="Attenzione: il bip esce dalle casse e finisce nella registrazione">
              <Chips
                options={[
                  { value: false, label: 'No' },
                  { value: true, label: 'Sì' }
                ]}
                value={s.beep}
                onChange={(v) => save({ beep: v })}
              />
            </Row>
          </Section>

          {/* ------------------------------------------------ YouTube */}
          <Section icon={<MonitorPlay />} title="YouTube">
            <Row label="Grandezza di YouTube" hint="Ingrandimento per leggere dalla TV">
              <Chips
                options={[1, 1.15, 1.25, 1.35, 1.5, 1.75].map((v) => ({ value: v, label: `${Math.round(v * 100)}%` }))}
                value={s.youtubeZoom}
                onChange={(v) => save({ youtubeZoom: v })}
              />
            </Row>
          </Section>

          {/* ------------------------------------------------ Aspetto */}
          <Section icon={<Palette />} title="Aspetto">
            <Row label="Nome dell'app">
              <div className="flex items-center gap-4">
                <span className="text-[1.8rem] font-black">{s.appName}</span>
                <Button
                  size="md"
                  variant="neutral"
                  icon={<Pencil />}
                  onClick={() => {
                    setDraft(s.appName)
                    setModal('name')
                  }}
                >
                  Cambia
                </Button>
              </div>
            </Row>
            <Row label="Tema">
              <Chips
                options={THEMES.map((t) => ({ value: t, label: THEME_LABELS[t] }))}
                value={s.theme}
                onChange={(v) => save({ theme: v })}
              />
            </Row>
          </Section>

          {/* ------------------------------------------------ Sistema */}
          <Section icon={<ShieldCheck />} title="Sistema">
            <Row label="Avvio automatico" hint="L'app parte da sola quando si accende il PC">
              <Chips
                options={[
                  { value: true, label: 'Sì' },
                  { value: false, label: 'No' }
                ]}
                value={s.autoStart}
                onChange={(v) => save({ autoStart: v })}
              />
            </Row>
            <Row label="Registrazioni eliminate" hint="Dopo quanti giorni vengono cancellate per sempre">
              <Chips
                options={[7, 14, 30, 60].map((v) => ({ value: v, label: `${v} giorni` }))}
                value={s.trashDays}
                onChange={(v) => save({ trashDays: v })}
              />
            </Row>
            <Row label="Cartella dei dati" hint={s.dataRootResolved}>
              <div className="flex flex-wrap gap-3">
                <Button size="md" variant="neutral" icon={<FolderOpen />} onClick={() => studio.settings.openDataFolder()}>
                  Apri in Esplora risorse
                </Button>
                <Button
                  size="md"
                  variant="ghost"
                  onClick={async () => {
                    const dir = await studio.settings.chooseDataFolder()
                    if (dir) {
                      await save({ dataRoot: dir }, 'Cartella cambiata')
                      setModal('restart')
                    }
                  }}
                >
                  Cambia cartella…
                </Button>
              </div>
            </Row>
          </Section>

          {/* ------------------------------------------------ Telecomando */}
          <Section icon={<Keyboard />} title="Tester dei tasti del telecomando">
            <div className="t-surface flex items-center gap-8 rounded-[1.2rem] border-2 px-6 py-5">
              {lastKey ? (
                <>
                  <KeyField label="key" value={lastKey.key} />
                  <KeyField label="code" value={lastKey.code || '—'} />
                  <KeyField label="keyCode" value={String(lastKey.keyCode)} />
                </>
              ) : (
                <span className="t-muted text-[1.6rem] font-bold">Premi un tasto del telecomando…</span>
              )}
            </div>
            <div className="t-muted mt-2 text-[1.25rem] font-bold">
              Indietro = Escape / BrowserBack / Backspace · Home = BrowserHome · Stop = MediaStop
            </div>
          </Section>

          {/* ------------------------------------------------ Informazioni */}
          <Section icon={<Info />} title="Informazioni">
            <Row label="Versione">
              <span className="text-[1.6rem] font-black">Studio Karaoke {s.version}</span>
            </Row>
            <div className="t-surface max-h-[18rem] overflow-y-auto rounded-[1.2rem] border-2 px-5 py-4 font-mono text-[1.1rem] leading-relaxed">
              {logs.length ? logs.map((l, i) => <div key={i}>{l}</div>) : <span className="t-muted">Registro vuoto</span>}
            </div>
            <div className="mt-2 flex gap-3">
              <Button size="md" variant="neutral" icon={<RotateCcw />} onClick={() => studio.settings.logs().then(setLogs)}>
                Aggiorna registro
              </Button>
              <Button size="md" variant="ghost" icon={<LogOut />} onClick={() => studio.quitApp()}>
                Chiudi l'app
              </Button>
            </div>
          </Section>
        </div>
      </div>

      {modal === 'name' && (
        <Dialog title="Nome dell'app" width="xl" onClose={() => setModal(null)}>
          <OnScreenKeyboard
            value={draft}
            onChange={setDraft}
            okLabel="Salva"
            onOk={() => {
              setModal(null)
              save({ appName: draft })
            }}
          />
        </Dialog>
      )}
      {modal === 'voiceTest' && (
        <VoiceOverlay
          title="Prova la voce"
          hint="Dì qualcosa, per esempio «Nel blu dipinto di blu»"
          confirmLabel="OK"
          onClose={() => setModal(null)}
          onResult={(t) => {
            setModal(null)
            toast({ tone: 'success', message: `Ho capito: «${t}»` })
          }}
        />
      )}
      {modal === 'restart' && (
        <Dialog
          title="Riavviare l'app?"
          icon={<RotateCcw className="t-accent-ink" />}
          onClose={() => setModal(null)}
          actions={
            <>
              <Button variant="accent" autoFocusNav onClick={() => studio.settings.restart()}>
                Riavvia ora
              </Button>
              <Button variant="neutral" onClick={() => setModal(null)}>
                Dopo
              </Button>
            </>
          }
        >
          La nuova cartella si usa dal prossimo avvio. Le registrazioni già fatte restano nella cartella vecchia: spostale a mano se vuoi.
        </Dialog>
      )}
    </div>
  )
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="t-header rounded-[1.6rem] border-2 px-7 py-6">
      <h2 className="mb-4 flex items-center gap-3 text-[2rem] font-black">
        <span className="t-accent-ink [&>svg]:size-[2.2rem]">{icon}</span>
        {title}
      </h2>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[19rem_1fr] items-start gap-6">
      <div className="pt-2">
        <div className="text-[1.5rem] font-extrabold">{label}</div>
        {hint && <div className="t-muted mt-1 text-[1.15rem] font-bold break-words">{hint}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Chips<T extends string | number | boolean>({
  options,
  value,
  onChange
}: {
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((o) => {
        const sel = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            data-nav=""
            data-nav-compact=""
            onClick={() => !sel && onChange(o.value)}
            className={`flex h-[3.8rem] max-w-full items-center gap-2 rounded-full border-2 px-5 text-[1.4rem] font-extrabold ${
              sel ? 't-btn-accent' : 't-btn-neutral'
            }`}
          >
            {sel && <Check className="size-[1.6rem] shrink-0" strokeWidth={3} />}
            <span className="truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function Status({ ok, children }: { ok: boolean | null; children: ReactNode }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-[1rem] border-2 px-4 py-3 text-[1.4rem] font-bold ${
        ok ? 't-surface' : ok === false ? 't-warn' : 't-surface t-muted'
      }`}
    >
      {ok ? <CircleCheck className="size-[2rem] shrink-0 text-ok" /> : <CircleAlert className="size-[2rem] shrink-0" />}
      <span>{children}</span>
    </div>
  )
}

function KeyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="t-muted text-[1.2rem] font-bold">{label}</span>
      <span className="font-mono text-[2.4rem] font-black">{value}</span>
    </div>
  )
}
