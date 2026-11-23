import { useCallback, useEffect, useRef, useState } from 'react'
import { studio } from '../lib/api'

const MIME = 'audio/webm;codecs=opus'

export interface FinishedRecording {
  tempId: string
  durationSec: number
}

/**
 * Registratore: MediaRecorder sull'ingresso del mixer, a pezzi di 1 secondo
 * scritti subito su disco (un crash non fa perdere la registrazione).
 * Il tempo conta solo mentre si registra davvero (non in pausa).
 */
export function useRecorder(stream: MediaStream | null) {
  const rec = useRef<MediaRecorder | null>(null)
  const idPromise = useRef<Promise<string> | null>(null)
  const writes = useRef<Promise<unknown>>(Promise.resolve())
  const accMs = useRef(0)
  const runningSince = useRef<number | null>(null)
  const [seconds, setSeconds] = useState(0)

  const elapsedMs = () => accMs.current + (runningSince.current !== null ? performance.now() - runningSince.current : 0)

  useEffect(() => {
    const id = window.setInterval(() => {
      if (rec.current) setSeconds(Math.floor(elapsedMs() / 1000))
    }, 250)
    return () => window.clearInterval(id)
  }, [])

  /** Avvia subito la registrazione (il file temporaneo si crea in parallelo) */
  const start = useCallback(
    (meta: { title: string; videoId?: string; videoTitle?: string }): boolean => {
      if (!stream || rec.current) return false
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(MIME) ? MIME : undefined,
        audioBitsPerSecond: 256_000
      })
      const idP = studio.recorder.begin(meta)
      idPromise.current = idP
      writes.current = idP
      mr.ondataavailable = (e) => {
        if (!e.data.size) return
        const blob = e.data
        writes.current = writes.current.then(async () => studio.recorder.chunk(await idP, await blob.arrayBuffer()))
      }
      mr.start(1000)
      rec.current = mr
      accMs.current = 0
      runningSince.current = performance.now()
      setSeconds(0)
      return true
    },
    [stream]
  )

  const pause = useCallback(() => {
    const mr = rec.current
    if (!mr || mr.state !== 'recording') return
    mr.pause()
    if (runningSince.current !== null) accMs.current += performance.now() - runningSince.current
    runningSince.current = null
  }, [])

  const resume = useCallback(() => {
    const mr = rec.current
    if (!mr || mr.state !== 'paused') return
    mr.resume()
    runningSince.current = performance.now()
  }, [])

  /** Ferma, attende che tutti i pezzi siano su disco e restituisce l'id del temporaneo */
  const stop = useCallback((): Promise<FinishedRecording | null> => {
    const mr = rec.current
    const idP = idPromise.current
    if (!mr || !idP) return Promise.resolve(null)
    const durationSec = Math.round(elapsedMs() / 1000)
    return new Promise((resolve) => {
      mr.onstop = async () => {
        try {
          await writes.current
          const tempId = await idP
          await studio.recorder.finish(tempId, durationSec)
          resolve({ tempId, durationSec })
        } catch {
          resolve(null)
        } finally {
          rec.current = null
          idPromise.current = null
          runningSince.current = null
          accMs.current = 0
        }
      }
      if (mr.state !== 'inactive') mr.stop()
      else mr.onstop?.(new Event('stop'))
    })
  }, [])

  // Uscendo dalla schermata con una registrazione aperta: la chiudiamo
  // (resta su disco e verrà proposta come "da recuperare")
  useEffect(
    () => () => {
      const mr = rec.current
      if (mr && mr.state !== 'inactive') mr.stop()
    },
    []
  )

  return { start, pause, resume, stop, seconds, isActive: () => rec.current !== null }
}
