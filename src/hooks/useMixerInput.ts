import { useEffect, useRef, useState } from 'react'
import { findMixer } from './useAudioDevices'
import { studio } from '../lib/api'

export interface MixerInput {
  stream: MediaStream | null
  analyser: AnalyserNode | null
  /** Nome del dispositivo in uso */
  label: string
  /** true se è il mixer USB; false se stiamo usando un altro microfono */
  isMixer: boolean
  error: string | null
}

/**
 * Apre l'ingresso audio del mixer appena si entra nella schermata YouTube,
 * così al "VAI!" la registrazione parte all'istante.
 *
 * Niente cancellazione dell'eco, riduzione del rumore o guadagno automatico:
 * rovinerebbero la voce. L'analizzatore serve solo al VU meter e NON è
 * collegato alle casse (niente monitoraggio: lo fa già il mixer).
 */
export function useMixerInput(active: boolean): MixerInput {
  const [state, setState] = useState<MixerInput>({ stream: null, analyser: null, label: '', isMixer: false, error: null })
  const current = useRef<{ stream: MediaStream; ctx: AudioContext; deviceId: string; isMixer: boolean } | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let opening = false

    const close = () => {
      const c = current.current
      if (!c) return
      c.stream.getTracks().forEach((t) => t.stop())
      c.ctx.close().catch(() => undefined)
      current.current = null
    }

    const open = async () => {
      if (opening || cancelled) return
      opening = true
      try {
        const hint = await studio.mixerHint()
        const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === 'audioinput' && d.deviceId !== 'communications'
        )
        const mixer = findMixer(inputs, hint)
        const cur = current.current
        const live = cur?.stream.getAudioTracks().some((t) => t.readyState === 'live')
        // Già aperto sul dispositivo giusto: niente da fare
        if (cur && live && (cur.isMixer || !mixer)) return

        close()
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: mixer ? { exact: mixer.deviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: { ideal: 2 },
            sampleRate: { ideal: 48000 }
          },
          video: false
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.2
        source.connect(analyser) // NON collegato a ctx.destination
        const track = stream.getAudioTracks()[0]
        track.addEventListener('ended', () => {
          // Cavo staccato: riproviamo appena torna
          setState((s) => ({ ...s, stream: null, analyser: null }))
          close()
        })
        current.current = { stream, ctx, deviceId: track.getSettings().deviceId ?? '', isMixer: !!mixer }
        setState({ stream, analyser, label: track.label, isMixer: !!mixer, error: null })
      } catch (err) {
        setState({ stream: null, analyser: null, label: '', isMixer: false, error: (err as Error).message })
      } finally {
        opening = false
      }
    }

    open()
    navigator.mediaDevices.addEventListener('devicechange', open)
    const id = window.setInterval(open, 4000)
    return () => {
      cancelled = true
      navigator.mediaDevices.removeEventListener('devicechange', open)
      window.clearInterval(id)
      close()
      setState({ stream: null, analyser: null, label: '', isMixer: false, error: null })
    }
  }, [active])

  return state
}
