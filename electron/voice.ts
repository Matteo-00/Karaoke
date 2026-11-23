/**
 * Riconoscimento vocale in locale con Whisper (transformers.js + onnxruntime).
 *
 * Il modello (whisper-base multilingua, ~140 MB) si scarica UNA volta sola da
 * internet al primo avvio e resta nella cartella dell'app: poi funziona anche
 * senza internet, gratis e senza account.
 */
import { app } from 'electron'
import { join } from 'node:path'
import type { VoiceStatus } from './ipc-types'

const MODEL = 'onnx-community/whisper-base'

type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>

let loading: Promise<Asr> | null = null
let status: VoiceStatus = { state: 'idle' }
let notify: (s: VoiceStatus) => void = () => {}

export function onVoiceStatus(cb: (s: VoiceStatus) => void): void {
  notify = cb
}
export const voiceStatus = () => status

function setStatus(s: VoiceStatus) {
  status = s
  notify(s)
}

/** Carica (e la prima volta scarica) il modello */
function load(log: (...a: unknown[]) => void): Promise<Asr> {
  if (loading) return loading
  loading = (async () => {
    setStatus({ state: 'loading', progress: 0 })
    const { pipeline, env } = await import('@huggingface/transformers')
    env.cacheDir = join(app.getPath('userData'), 'modelli')
    const files = new Map<string, number>()
    const asr = (await pipeline('automatic-speech-recognition', MODEL, {
      device: 'cpu',
      dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
      progress_callback: (p: { status: string; file?: string; progress?: number }) => {
        if (p.status === 'progress' && p.file) {
          files.set(p.file, p.progress ?? 0)
          const avg = [...files.values()].reduce((a, b) => a + b, 0) / files.size
          setStatus({ state: 'loading', progress: Math.round(avg) })
        }
      }
    })) as unknown as Asr
    setStatus({ state: 'ready' })
    log('riconoscimento vocale pronto')
    return asr
  })().catch((err: Error) => {
    loading = null
    setStatus({ state: 'error', message: 'Serve internet la prima volta per scaricare la voce' })
    log('riconoscimento vocale non disponibile:', err.message)
    throw err
  })
  return loading
}

/** Prepara il modello in sottofondo (così la prima ricerca è veloce) */
export function warmUpVoice(log: (...a: unknown[]) => void): void {
  if (process.env.STUDIO_FAKE_STT) {
    setStatus({ state: 'ready' })
    return
  }
  load(log).catch(() => undefined)
}

/** Frasi che Whisper "inventa" sul silenzio */
const HALLUCINATIONS = [
  /sottotitoli (creati|a cura|e revisione)/i,
  /grazie (a tutti )?per (la visione|l'ascolto|aver guardato)/i,
  /iscriviti al canale/i,
  /amara\.org/i,
  /^\W*$/
]

/** Trascrive audio mono a 16 kHz in italiano */
export async function transcribe(samples: Float32Array, log: (...a: unknown[]) => void): Promise<string> {
  // Per le prove senza modello: STUDIO_FAKE_STT="testo"
  if (process.env.STUDIO_FAKE_STT) return process.env.STUDIO_FAKE_STT
  const asr = await load(log)
  const started = Date.now()
  const out = await asr(samples, { language: 'italian', task: 'transcribe', chunk_length_s: 30 })
  const raw = (Array.isArray(out) ? out[0]?.text : out.text) ?? ''
  const text = raw
    .trim()
    .replace(/^["'«“]+|["'»”.!?,;:]+$/g, '')
    .trim()
  log(`voce trascritta in ${Date.now() - started} ms: «${text}»`)
  return HALLUCINATIONS.some((h) => h.test(text)) ? '' : text
}
