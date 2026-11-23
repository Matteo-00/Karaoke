/** Utilità per i testi mostrati all'utente */

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** "23-11-2026" */
export function shortDate(d: Date = new Date()): string {
  return dateFmt.format(d).replace(/\//g, '-')
}

/** "3:05" */
export function duration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const dateTimeFmt = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

/** "23 nov 2026, 18:42" */
export function dateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso))
}

const NOISE = /\b(karaoke|base(?: musicale)?|con testo|testo|lyrics?|instrumental|strumentale|official|video ufficiale|hd|hq|4k)\b/i

/**
 * Titolo pulito dal titolo di YouTube:
 * "Volare (Nel blu dipinto di blu) – Karaoke con testo" → "Volare (Nel blu dipinto di blu)"
 */
export function cleanSongTitle(videoTitle: string): string {
  let t = videoTitle
  // Parentesi che contengono solo "rumore" (karaoke, base, testo…)
  t = t.replace(/[([{【]([^)\]}】]*)[)\]}】]/g, (m, inner: string) => (NOISE.test(inner) ? ' ' : m))
  // Parti separate da " - " / " – " / " | " che sono solo "rumore"
  t = t
    .split(/\s[-–—|]\s/)
    .filter((part, i) => i === 0 || !NOISE.test(part))
    .join(' – ')
  t = t.replace(/\s+/g, ' ').trim()
  return t || videoTitle.trim()
}

/** Nome proposto per il salvataggio: "Volare – 23-11-2026" */
export function defaultRecordingName(videoTitle: string): string {
  const base = cleanSongTitle(videoTitle || 'Registrazione')
  return `${base} – ${shortDate()}`
}

/** Per cercare senza badare a maiuscole e accenti */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** "1 canzone" / "12 canzoni" */
export function songsCount(n: number): string {
  return n === 1 ? '1 canzone' : `${n} canzoni`
}
