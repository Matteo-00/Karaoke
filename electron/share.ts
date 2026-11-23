/**
 * Condivisione delle registrazioni:
 *
 * 1. "Sul telefono, senza fili": un piccolo server web temporaneo sulla rete
 *    di casa. Sulla TV compare un QR code: il telefono (sullo stesso Wi‑Fi) lo
 *    inquadra con la fotocamera e scarica le canzoni. Il link contiene un codice
 *    casuale e smette di funzionare dopo 20 minuti o alla chiusura del dialog.
 *
 * 2. "Su una chiavetta USB": copia i file nella cartella "Studio Karaoke"
 *    della chiavetta.
 */
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, stat, statfs } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { networkInterfaces, userInfo } from 'node:os'
import { basename, extname, join } from 'node:path'
import QRCode from 'qrcode'
import type { Recording, PhoneShare, UsbDrive } from './ipc-types'

const PORT = 47800 // porta fissa: la regola del firewall di Windows resta valida
const LIFETIME_MS = 20 * 60_000

interface ShareState {
  server: Server
  token: string
  files: { rec: Recording; path: string }[]
  timer: NodeJS.Timeout
}

let current: ShareState | null = null

/** Indirizzo del PC sulla rete di casa (192.168.x.x, 10.x.x.x…) */
function lanAddress(): string | null {
  const candidates: string[] = []
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) candidates.push(a.address)
    }
  }
  const score = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3)
  candidates.sort((a, b) => score(a) - score(b))
  return candidates[0] ?? null
}

export async function startPhoneShare(
  files: { rec: Recording; path: string }[],
  onDownload: (id: string) => void
): Promise<PhoneShare> {
  await stopPhoneShare()
  const ip = lanAddress()
  if (!ip) throw new Error('Il PC non è collegato alla rete di casa (Wi‑Fi o cavo)')

  const token = randomBytes(8).toString('hex')
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const prefix = `/s/${token}`
    if (!url.pathname.startsWith(prefix)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Link scaduto. Chiedi un nuovo codice dalla TV.')
      return
    }
    const rest = url.pathname.slice(prefix.length)
    if (rest === '' || rest === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(phonePage(files.map((f) => f.rec), prefix))
      return
    }
    const m = rest.match(/^\/f\/([\w-]+)$/)
    const file = m && files.find((f) => f.rec.id === m[1])
    if (!file || !existsSync(file.path)) {
      res.writeHead(404).end()
      return
    }
    stat(file.path).then((st) => {
      const name = `${file.rec.title}${extname(file.path) || '.mp3'}`
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': st.size,
        'Content-Disposition': `attachment; filename="${asciiName(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`
      })
      const stream = createReadStream(file.path)
      stream.pipe(res)
      stream.on('end', () => onDownload(file.rec.id))
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EADDRINUSE') return reject(err)
      // Porta occupata: ne prendiamo una libera
      server.listen(0, '0.0.0.0', () => resolve())
    })
    server.listen(PORT, '0.0.0.0', () => resolve())
  })

  const port = (server.address() as { port: number }).port
  const url = `http://${ip}:${port}/s/${token}/`
  const timer = setTimeout(() => void stopPhoneShare(), LIFETIME_MS)
  current = { server, token, files, timer }
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 640, errorCorrectionLevel: 'M' })
  return { url, qr, expiresAt: new Date(Date.now() + LIFETIME_MS).toISOString() }
}

export async function stopPhoneShare(): Promise<void> {
  const s = current
  current = null
  if (!s) return
  clearTimeout(s.timer)
  await new Promise<void>((resolve) => {
    s.server.close(() => resolve())
    s.server.closeAllConnections?.()
  })
}

function asciiName(name: string): string {
  return name.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'canzone.mp3'
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Pagina mostrata sul telefono */
function phonePage(recs: Recording[], prefix: string): string {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`
  const items = recs
    .map(
      (r) => `<li><div><b>${esc(r.title)}</b><small>${fmt(r.durationSec)}</small></div>
      <a class="btn" href="${prefix}/f/${r.id}" download>Scarica</a></li>`
    )
    .join('')
  return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Studio Karaoke</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#1b212c;color:#eef1f6}
  header{padding:24px 20px 8px} h1{margin:0;font-size:26px} p{color:#9aa5b8;margin:6px 0 0}
  ul{list-style:none;margin:0;padding:12px 16px 40px}
  li{display:flex;align-items:center;gap:12px;background:#2c3443;border-radius:16px;padding:14px 16px;margin-bottom:12px}
  li div{flex:1;min-width:0} li b{display:block;font-size:18px;overflow:hidden;text-overflow:ellipsis}
  li small{color:#9aa5b8}
  .btn{background:#35a99c;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;white-space:nowrap}
  .all{display:block;margin:8px 16px;text-align:center;font-size:18px;background:#f0626a;border:0;width:calc(100% - 32px);padding:16px}
</style></head><body>
<header><h1>🎤 Le canzoni di Studio Karaoke</h1><p>Tocca «Scarica» per salvarle sul telefono.</p></header>
${recs.length > 1 ? '<button class="btn all" id="all">Scarica tutte (' + recs.length + ')</button>' : ''}
<ul>${items}</ul>
<script>
  var b=document.getElementById('all');
  if(b) b.onclick=function(){var l=document.querySelectorAll('li a');var i=0;(function n(){if(i>=l.length)return;l[i++].click();setTimeout(n,1500)})()};
</script>
</body></html>`
}

// ======================================================= chiavetta USB

/** Unità rimovibili collegate */
export async function listUsbDrives(): Promise<UsbDrive[]> {
  if (process.platform === 'win32') return listWindowsDrives()
  // Linux / macOS (sviluppo): cartelle di montaggio standard
  const roots = process.platform === 'darwin' ? ['/Volumes'] : [`/media/${userInfo().username}`, '/media', `/run/media/${userInfo().username}`]
  const drives: UsbDrive[] = []
  for (const root of roots) {
    const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
    for (const e of entries) {
      const p = join(root, e.name)
      if (!e.isDirectory() || drives.some((d) => d.path === p) || roots.includes(p)) continue
      if (process.platform === 'darwin' && e.name === 'Macintosh HD') continue
      const fs = await statfs(p).catch(() => null)
      drives.push({ path: p, label: e.name, freeBytes: fs ? fs.bavail * fs.bsize : 0 })
    }
  }
  return drives
}

function listWindowsDrives(): Promise<UsbDrive[]> {
  const ps =
    'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=2" | Select-Object DeviceID,VolumeName,FreeSpace | ConvertTo-Json -Compress'
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, timeout: 8000 }, (err, stdout) => {
      if (err || !stdout.trim()) return resolve([])
      try {
        const raw = JSON.parse(stdout)
        const list = (Array.isArray(raw) ? raw : [raw]) as { DeviceID: string; VolumeName: string | null; FreeSpace: number | null }[]
        resolve(
          list
            .filter((d) => d.FreeSpace !== null) // lettori di schede vuoti
            .map((d) => ({
              path: d.DeviceID + '\\',
              label: `${d.VolumeName || 'Chiavetta USB'} (${d.DeviceID})`,
              freeBytes: d.FreeSpace ?? 0
            }))
        )
      } catch {
        resolve([])
      }
    })
  })
}

/** Copia le canzoni in <chiavetta>\Studio Karaoke\<cartella>\ */
export async function copyToUsb(files: { rec: Recording; path: string }[], drivePath: string): Promise<number> {
  const drives = await listUsbDrives()
  if (!drives.some((d) => d.path === drivePath)) throw new Error('La chiavetta non è più collegata')
  const total = (await Promise.all(files.map((f) => stat(f.path).then((s) => s.size)))).reduce((a, b) => a + b, 0)
  const free = drives.find((d) => d.path === drivePath)?.freeBytes ?? 0
  if (free && total > free) throw new Error('Sulla chiavetta non c’è abbastanza spazio')

  let copied = 0
  for (const f of files) {
    const folder = f.rec.folder === '__deleted__' ? (f.rec.originalFolder ?? 'Generale') : f.rec.folder
    const dir = join(drivePath, 'Studio Karaoke', folder)
    await mkdir(dir, { recursive: true })
    const ext = extname(f.path) || '.mp3'
    const base = basename(f.path, ext)
    const size = (await stat(f.path)).size
    // Già copiata in precedenza (stesso nome e stessa dimensione): la saltiamo
    const same = await stat(join(dir, `${base}${ext}`)).then((s) => s.size === size).catch(() => false)
    if (!same) {
      let name = `${base}${ext}`
      for (let n = 2; existsSync(join(dir, name)); n++) name = `${base} (${n})${ext}`
      await copyFile(f.path, join(dir, name))
    }
    copied++
  }
  return copied
}
