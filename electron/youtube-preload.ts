/**
 * Script iniettato nella pagina di YouTube (mondo isolato: vede il DOM ma non
 * gli script di YouTube).
 *
 * - Quando parte un video nuovo lo mette subito in pausa, lo riporta all'inizio
 *   e avvisa l'interfaccia, che chiede "Vuoi registrare?".
 * - Durante la pubblicità non chiede nulla: aspetta che torni il contenuto.
 * - Riferisce lo stato del player (in riproduzione, pausa, pubblicità, fine).
 *
 * YouTube è una SPA: oltre agli eventi `yt-navigate-finish` controlliamo lo
 * stato ogni 400 ms, il che rende il meccanismo robusto ai cambi del sito.
 */
import { ipcRenderer } from 'electron'
// Solo tipi: il preload in sandbox deve restare un unico file senza altri moduli
import type { YtCommand, YtEvent } from './ipc-types'

/** Devono coincidere con IPC.ytFromPage e IPC.ytCommand in ipc-types.ts */
const IPC = { ytFromPage: 'yt:from-page', ytCommand: 'yt:command' } as const

/** Video per cui abbiamo già chiesto (non richiedere finché non lo si riapre) */
let handledId: string | null = null
/** true mentre aspettiamo la scelta dell'utente: il video deve restare fermo */
let holding = false
/** Ultimo videoId visto nell'indirizzo (null fuori dalle pagine video) */
let lastNavId: string | null = null
let lastHref = location.href
let lastReport = ''

const send = (ev: YtEvent) => ipcRenderer.send(IPC.ytFromPage, ev)

function currentVideoId(): string | null {
  try {
    const url = new URL(location.href)
    if (url.pathname === '/watch') return url.searchParams.get('v')
    const m = url.pathname.match(/^\/(?:shorts|live)\/([^/?#]+)/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

function player(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#movie_player') ?? document.querySelector<HTMLElement>('.html5-video-player')
}

function mainVideo(): HTMLVideoElement | null {
  return player()?.querySelector<HTMLVideoElement>('video.html5-main-video') ?? player()?.querySelector('video') ?? null
}

function isAd(): boolean {
  const p = player()
  return !!p && (p.classList.contains('ad-showing') || p.classList.contains('ad-interrupting'))
}

function videoTitle(): string {
  const h =
    document.querySelector('ytd-watch-metadata h1 yt-formatted-string') ??
    document.querySelector('ytd-watch-metadata h1') ??
    document.querySelector('h1.title')
  const fromPage = h?.textContent?.trim()
  if (fromPage) return fromPage
  return document.title
    .replace(/^\(\d+\)\s*/, '')
    .replace(/\s*-\s*YouTube\s*$/, '')
    .trim()
}

/** Blocca il video appena partito e chiede all'interfaccia cosa fare */
function intercept(video: HTMLVideoElement, id: string): void {
  handledId = id
  lastNavId = id
  holding = true
  video.pause()
  try {
    video.currentTime = 0
  } catch {
    /* alcuni stream non lo permettono */
  }
  send({ type: 'video-start', videoId: id, title: videoTitle(), duration: video.duration || 0 })
  // Nella SPA il titolo si aggiorna con un po' di ritardo: lo rimandiamo
  for (const ms of [900, 2500]) {
    setTimeout(() => {
      if (currentVideoId() === id) send({ type: 'meta', videoId: id, title: videoTitle() })
    }, ms)
  }
}

function report(): void {
  const v = mainVideo()
  const id = currentVideoId()
  const ev: YtEvent = {
    type: 'state',
    videoId: id,
    title: id ? videoTitle() : '',
    playing: !!v && !v.paused && !v.ended,
    ad: isAd(),
    ended: !!v?.ended,
    duration: v?.duration && Number.isFinite(v.duration) ? v.duration : 0
  }
  const key = JSON.stringify({ ...ev, duration: Math.round(ev.duration) })
  if (key !== lastReport) {
    lastReport = key
    send(ev)
  }
}

/** Cambio di pagina: se si riapre lo stesso video si chiederà di nuovo */
function onNavigate(): void {
  if (location.href === lastHref) return
  lastHref = location.href
  const id = currentVideoId()
  if (id !== lastNavId) {
    if (id !== null && id === handledId) handledId = null // video riaperto
    lastNavId = id
    if (id === null) holding = false
  }
}

/** Controllo centrale: chiamato a ogni "play" e periodicamente */
function check(): void {
  onNavigate()
  const v = mainVideo()
  const id = currentVideoId()
  if (v && id && !isAd()) {
    if (id !== handledId && !v.paused) {
      intercept(v, id)
    } else if (holding && id === handledId && !v.paused) {
      // YouTube ha fatto ripartire il video da solo mentre aspettiamo la risposta
      v.pause()
    }
  }
  report()
}

// Gli eventi dei media non risalgono il DOM: li ascoltiamo in fase di cattura
document.addEventListener(
  'play',
  (e) => {
    if (e.target === mainVideo()) check()
  },
  true
)
document.addEventListener('pause', (e) => e.target === mainVideo() && report(), true)
document.addEventListener(
  'ended',
  (e) => {
    const id = currentVideoId()
    if (e.target === mainVideo() && !isAd() && id && id === handledId) send({ type: 'ended', videoId: id })
    report()
  },
  true
)
window.addEventListener('yt-navigate-finish', () => check())
window.addEventListener('popstate', () => check())
setInterval(check, 400)

ipcRenderer.on(IPC.ytCommand, (_e, cmd: YtCommand) => {
  const v = mainVideo()
  switch (cmd) {
    case 'play':
      holding = false
      v?.play().catch(() => undefined)
      break
    case 'pause':
      v?.pause()
      break
    case 'hold':
      holding = true
      handledId = currentVideoId()
      v?.pause()
      break
    case 'restart':
      if (v) {
        try {
          v.currentTime = 0
        } catch {
          /* ignorato */
        }
      }
      break
    case 'release':
      holding = false
      break
    case 'forget':
      handledId = null
      break
  }
  report()
})
