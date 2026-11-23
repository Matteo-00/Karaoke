import { useSyncExternalStore } from 'react'

/**
 * Contatore dei livelli aperti sopra lo schermo (dialog, conto alla rovescia).
 * YouTube è una vista nativa che copre l'interfaccia: quando c'è almeno un
 * livello aperto la schermata YouTube la nasconde.
 */
let count = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function pushOverlay(): () => void {
  count++
  emit()
  let done = false
  return () => {
    if (done) return
    done = true
    count--
    emit()
  }
}

export function useOverlayCount(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => count
  )
}
