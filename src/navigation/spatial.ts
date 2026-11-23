/**
 * Navigazione spaziale con le frecce del telecomando.
 *
 * Ogni elemento navigabile ha l'attributo `data-nav`. Il focus si muove
 * sempre dentro lo "scope" attivo: l'ultimo elemento `data-nav-scope`
 * presente nella pagina (es. un dialog aperto), così i dialog intrappolano
 * il focus. `data-autofocus` indica l'elemento che riceve il focus iniziale.
 */

export type Direction = 'up' | 'down' | 'left' | 'right'

const NAV_SELECTOR = '[data-nav]:not([disabled]):not([aria-disabled="true"])'

/** Lo scope attivo: il dialog più in alto, altrimenti tutta la pagina */
export function activeScope(): HTMLElement {
  const scopes = document.querySelectorAll<HTMLElement>('[data-nav-scope]')
  return scopes.length ? scopes[scopes.length - 1] : document.body
}

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return false
  const style = getComputedStyle(el)
  return style.visibility !== 'hidden' && style.display !== 'none'
}

export function navigables(scope: HTMLElement = activeScope()): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(NAV_SELECTOR)).filter(isVisible)
}

/** Porta il focus sull'elemento predefinito dello scope */
export function focusDefault(scope: HTMLElement = activeScope()): boolean {
  const items = navigables(scope)
  const target = items.find((el) => el.hasAttribute('data-autofocus')) ?? items[0]
  if (!target) return false
  target.focus({ preventScroll: false })
  return true
}

/** true se il focus è su un elemento navigabile dello scope attivo */
export function focusIsInScope(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el || el === document.body) return false
  return activeScope().contains(el) && el.matches(NAV_SELECTOR)
}

/**
 * Sposta il focus verso l'elemento più vicino nella direzione indicata.
 * Il punteggio privilegia gli elementi "allineati" (stessa riga o colonna).
 */
export function moveFocus(dir: Direction): boolean {
  if (!focusIsInScope()) return focusDefault()

  const current = document.activeElement as HTMLElement
  const c = current.getBoundingClientRect()
  const cx = c.left + c.width / 2
  const cy = c.top + c.height / 2

  let best: HTMLElement | null = null
  let bestScore = Infinity

  for (const el of navigables()) {
    if (el === current) continue
    const r = el.getBoundingClientRect()
    const rx = r.left + r.width / 2
    const ry = r.top + r.height / 2

    let primary: number // distanza nella direzione di movimento
    let ortho: number // scostamento laterale (0 se si sovrappongono)
    switch (dir) {
      case 'right':
        if (rx <= cx + 1 || r.right <= c.right) continue
        primary = Math.max(0, r.left - c.right)
        ortho = overlapGap(r.top, r.bottom, c.top, c.bottom)
        break
      case 'left':
        if (rx >= cx - 1 || r.left >= c.left) continue
        primary = Math.max(0, c.left - r.right)
        ortho = overlapGap(r.top, r.bottom, c.top, c.bottom)
        break
      case 'down':
        if (ry <= cy + 1 || r.bottom <= c.bottom) continue
        primary = Math.max(0, r.top - c.bottom)
        ortho = overlapGap(r.left, r.right, c.left, c.right)
        break
      case 'up':
        if (ry >= cy - 1 || r.top >= c.top) continue
        primary = Math.max(0, c.top - r.bottom)
        ortho = overlapGap(r.left, r.right, c.left, c.right)
        break
    }
    const centerOffset = dir === 'left' || dir === 'right' ? Math.abs(ry - cy) : Math.abs(rx - cx)
    const score = primary + ortho * 3 + centerOffset * 0.15
    if (score < bestScore) {
      bestScore = score
      best = el
    }
  }

  if (best) {
    best.focus()
    best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    return true
  }
  return false
}

/** Distanza tra due intervalli (0 se si sovrappongono) */
function overlapGap(a1: number, a2: number, b1: number, b2: number): number {
  if (a2 < b1) return b1 - a2
  if (b2 < a1) return a1 - b2
  return 0
}
