import { useEffect, useState } from 'react'

/** Apre un ingresso audio solo per mostrarne il livello (prova del microfono) */
export function useDeviceLevel(deviceId: string | null): AnalyserNode | null {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  useEffect(() => {
    if (!deviceId) return
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let alive = true
    navigator.mediaDevices
      .getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop())
        stream = s
        ctx = new AudioContext()
        const a = ctx.createAnalyser()
        a.fftSize = 2048
        ctx.createMediaStreamSource(s).connect(a)
        setAnalyser(a)
      })
      .catch(() => setAnalyser(null))
    return () => {
      alive = false
      stream?.getTracks().forEach((t) => t.stop())
      ctx?.close().catch(() => undefined)
      setAnalyser(null)
    }
  }, [deviceId])
  return analyser
}
