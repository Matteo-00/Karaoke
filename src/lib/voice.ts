/**
 * Cattura della voce per la ricerca vocale e la dettatura.
 *
 * Tiene sempre in memoria l'ultimo secondo di audio ("pre‑ascolto"), così le
 * prime parole non si perdono anche se l'ascolto parte un attimo dopo.
 * Produce audio mono a 16 kHz, il formato che serve a Whisper.
 */
import { findMixer } from '../hooks/useAudioDevices'

const TARGET_RATE = 16_000
const PREROLL_SEC = 1

export interface VoiceDevice {
  deviceId: string
  label: string
  /** true se è un microfono separato dal mixer (es. quello del telecomando) */
  separate: boolean
}

/** Sceglie il microfono per la voce: quello impostato, altrimenti uno diverso dal mixer, altrimenti il mixer */
export async function pickVoiceDevice(voiceLabel: string, mixerHint: string): Promise<VoiceDevice | null> {
  const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications'
  )
  if (!inputs.length) return null
  const mixer = findMixer(inputs, mixerHint)
  const chosen = voiceLabel ? inputs.find((d) => d.label === voiceLabel) : undefined
  const other = inputs.find((d) => d.deviceId !== mixer?.deviceId)
  const dev = chosen ?? other ?? mixer ?? inputs[0]
  return { deviceId: dev.deviceId, label: dev.label, separate: dev.deviceId !== mixer?.deviceId }
}

export class VoiceEngine {
  private stream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private proc: ScriptProcessorNode | null = null
  private ring: Float32Array[] = []
  private ringLen = 0
  private capture: Float32Array[] | null = null
  private rate = 48_000
  /** Livello attuale in dB (−100 … 0) */
  level = -100
  onLevel: ((db: number) => void) | null = null

  async open(deviceId: string): Promise<void> {
    this.close()
    this.stream = await navigator.mediaDevices.getUserMedia({
      // Per la voce sì alla riduzione del rumore: aiuta il riconoscimento
      audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
    })
    this.ctx = new AudioContext()
    this.rate = this.ctx.sampleRate
    const src = this.ctx.createMediaStreamSource(this.stream)
    this.proc = this.ctx.createScriptProcessor(4096, 1, 1)
    const silent = this.ctx.createGain()
    silent.gain.value = 0 // serve solo a far girare il processore: nessun suono esce
    src.connect(this.proc)
    this.proc.connect(silent).connect(this.ctx.destination)
    this.proc.onaudioprocess = (e) => {
      const data = new Float32Array(e.inputBuffer.getChannelData(0))
      let peak = 0
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]))
      this.level = 20 * Math.log10(peak || 1e-5)
      this.onLevel?.(this.level)
      if (this.capture) this.capture.push(data)
      this.ring.push(data)
      this.ringLen += data.length
      while (this.ringLen - this.ring[0].length > this.rate * PREROLL_SEC) this.ringLen -= this.ring.shift()!.length
    }
  }

  get isOpen() {
    return !!this.stream
  }

  /** Inizia a raccogliere l'audio (con il pre‑ascolto) */
  start(preroll = true): void {
    this.capture = preroll ? [...this.ring] : []
  }

  /** Smette di raccogliere e restituisce audio mono 16 kHz */
  finish(): Float32Array {
    const chunks = this.capture ?? []
    this.capture = null
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const all = new Float32Array(total)
    let o = 0
    for (const c of chunks) {
      all.set(c, o)
      o += c.length
    }
    return resample(all, this.rate, TARGET_RATE)
  }

  close(): void {
    this.proc?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.ctx?.close().catch(() => undefined)
    this.stream = null
    this.ctx = null
    this.proc = null
    this.capture = null
    this.ring = []
    this.ringLen = 0
  }
}

/** Ricampionamento semplice (media dei campioni) */
function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input
  const ratio = from / to
  const out = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    out[i] = sum / Math.max(1, end - start)
  }
  return out
}
