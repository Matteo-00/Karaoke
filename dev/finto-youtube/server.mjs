/**
 * "Finto YouTube": pagina di prova che imita il player di YouTube
 * (#movie_player, video.html5-main-video, classe .ad-showing, evento
 * yt-navigate-finish), per provare l'app senza internet.
 *
 *   npm run finto-youtube        (in un terminale)
 *   npm run dev:finto-youtube    (in un altro)
 *
 * Serve ffmpeg nel PATH per generare il video di prova la prima volta.
 */
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync, createReadStream } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const cache = join(here, '.cache')
const video = join(cache, 'prova.webm')
const PORT = Number(process.env.PORT ?? 8765)

if (!existsSync(video)) {
  mkdirSync(cache, { recursive: true })
  console.log('Genero il video di prova con ffmpeg…')
  execFileSync('ffmpeg', [
    '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=854x480:rate=25',
    '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000',
    '-t', '40', '-c:v', 'libvpx', '-b:v', '600k', '-c:a', 'libopus', '-shortest', video
  ])
}

createServer((req, res) => {
  if (req.url?.startsWith('/prova.webm')) {
    const size = statSync(video).size
    const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/)
    if (range) {
      const start = Number(range[1])
      const end = range[2] ? Number(range[2]) : size - 1
      res.writeHead(206, {
        'Content-Type': 'video/webm',
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1
      })
      createReadStream(video, { start, end }).pipe(res)
    } else {
      res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': size, 'Accept-Ranges': 'bytes' })
      createReadStream(video).pipe(res)
    }
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(readFileSync(join(here, 'index.html')))
}).listen(PORT, '127.0.0.1', () => console.log(`Finto YouTube su http://127.0.0.1:${PORT}`))
