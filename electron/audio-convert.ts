/**
 * Conversione audio con ffmpeg (ffmpeg-static) e lettura della durata.
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import ffmpegStatic from 'ffmpeg-static'
import { parseFile } from 'music-metadata'

/** Percorso di ffmpeg; nell'app installata è fuori dall'archivio asar */
function ffmpegPath(): string {
  const fromEnv = process.env.STUDIO_FFMPEG
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const p = (ffmpegStatic as unknown as string | null) ?? 'ffmpeg'
  return p.replace('app.asar' + (process.platform === 'win32' ? '\\' : '/'), 'app.asar.unpacked' + (process.platform === 'win32' ? '\\' : '/'))
}

/** WebM/Opus (MediaRecorder) → MP3 stereo 48 kHz */
export function convertToMp3(input: string, output: string, opts: { bitrate: number; title: string }): Promise<void> {
  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', input,
    '-vn',
    '-ac', '2',
    '-ar', '48000',
    '-codec:a', 'libmp3lame',
    '-b:a', `${opts.bitrate}k`,
    '-metadata', `title=${opts.title}`,
    '-metadata', 'artist=Studio Karaoke',
    output
  ]
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath(), args, { windowsHide: true, timeout: 10 * 60_000 }, (err, _stdout, stderr) => {
      if (err) reject(new Error(`ffmpeg: ${stderr || err.message}`))
      else resolve()
    })
  })
}

/** Durata in secondi (0 se non leggibile) */
export async function readDuration(file: string): Promise<number> {
  try {
    const meta = await parseFile(file, { duration: true })
    return Math.round(meta.format.duration ?? 0)
  } catch {
    return 0
  }
}
