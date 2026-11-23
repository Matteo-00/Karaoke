import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_FOLDER, type LibrarySnapshot } from '../../electron/ipc-types'
import { studio } from '../lib/api'

/** Archivio delle registrazioni, aggiornato automaticamente a ogni modifica */
export function useLibrary() {
  const [data, setData] = useState<LibrarySnapshot>({ recordings: [], folders: [DEFAULT_FOLDER] })
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const s = await studio.library.get()
    setData(s)
    setLoaded(true)
  }, [])

  useEffect(() => {
    refresh()
    return studio.library.onChanged(refresh)
  }, [refresh])

  return { ...data, loaded, refresh }
}
