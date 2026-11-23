import { useCallback, useEffect, useState } from 'react'

/** Parole che identificano il mixer Alto Live 802 visto da Windows */
const MIXER_HINTS = ['usb audio codec', 'usb audio']

export interface AudioDevicesState {
  inputs: MediaDeviceInfo[]
  outputs: MediaDeviceInfo[]
  /** null finché non abbiamo ancora controllato */
  mixerConnected: boolean | null
  mixerInput?: MediaDeviceInfo
}

/** Il primo ingresso il cui nome contiene "USB Audio CODEC" o "USB Audio" */
export function findMixer(inputs: MediaDeviceInfo[], hint?: string): MediaDeviceInfo | undefined {
  const hints = hint ? [hint.toLowerCase(), ...MIXER_HINTS] : MIXER_HINTS
  for (const h of hints) {
    const found = inputs.find((d) => d.label.toLowerCase().includes(h))
    if (found) return found
  }
  return undefined
}

/**
 * Elenco dei dispositivi audio e stato del mixer USB.
 * Ricontrolla all'evento `devicechange` e comunque ogni 4 secondi.
 */
export function useAudioDevices(pollMs = 4000): AudioDevicesState {
  const [state, setState] = useState<AudioDevicesState>({ inputs: [], outputs: [], mixerConnected: null })

  const refresh = useCallback(async () => {
    // Anteprima nel browser: ?mixer=1 / ?mixer=0 forza lo stato
    const forced = new URLSearchParams(location.search).get('mixer')
    if (forced !== null && !window.studio) {
      setState({ inputs: [], outputs: [], mixerConnected: forced === '1' })
      return
    }
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      const inputs = all.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications')
      const outputs = all.filter((d) => d.kind === 'audiooutput')
      const mixerInput = findMixer(inputs)
      setState({ inputs, outputs, mixerInput, mixerConnected: !!mixerInput })
    } catch {
      setState((s) => ({ ...s, mixerConnected: false }))
    }
  }, [])

  useEffect(() => {
    refresh()
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh)
    const id = window.setInterval(refresh, pollMs)
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh)
      window.clearInterval(id)
    }
  }, [refresh, pollMs])

  return state
}
