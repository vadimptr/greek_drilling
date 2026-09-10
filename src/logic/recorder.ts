import { downsample, encodeWav, rms, TARGET_RATE } from './wav'

/**
 * Запись одного короткого высказывания с микрофона через Web Audio (работает в Safari iOS, в т.ч. с
 * домашнего экрана, и в Chrome). Останавливается по тишине после речи или по максимальной длине.
 */

export const MAX_MS = 4000
export const SILENCE_MS = 700
/** Порог RMS: выше — считаем, что человек говорит. */
export const SPEECH_RMS = 0.02
/** Короткая пауза перед записью, чтобы не поймать щелчок тапа. */
const PREROLL_MS = 120

export type RecorderResult = { kind: 'wav'; wav: ArrayBuffer; ms: number } | { kind: 'silence' }

export class MicError extends Error {
  constructor(
    public readonly kind: 'denied' | 'unsupported',
    message: string,
  ) {
    super(message)
  }
}

export function canRecord(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    (typeof AudioContext !== 'undefined' || 'webkitAudioContext' in window)
  )
}

interface Options {
  onLevel?: (level: number) => void
  /** Внешний сигнал остановки (повторный тап по кнопке). */
  stop?: AbortSignal
}

export async function recordUtterance(options: Options = {}): Promise<RecorderResult> {
  if (!canRecord()) throw new MicError('unsupported', 'no getUserMedia')

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch (e) {
    throw new MicError('denied', String(e))
  }

  const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
  const ctx = new Ctx()
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined)
  const source = ctx.createMediaStreamSource(stream)
  // ScriptProcessor устарел, но это единственный вариант, одинаково работающий во всех мобильных браузерах
  const processor = ctx.createScriptProcessor(4096, 1, 1)
  const sink = ctx.createGain()
  sink.gain.value = 0

  const chunks: Float32Array[] = []
  let heardSpeech = false
  let silentMs = 0
  let elapsedMs = 0

  const result = await new Promise<RecorderResult>((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      processor.disconnect()
      source.disconnect()
      sink.disconnect()
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close().catch(() => undefined)
      if (!heardSpeech) return resolve({ kind: 'silence' })
      const total = chunks.reduce((n, c) => n + c.length, 0)
      const all = new Float32Array(total)
      let o = 0
      for (const c of chunks) {
        all.set(c, o)
        o += c.length
      }
      const pcm = downsample(all, ctx.sampleRate, TARGET_RATE)
      resolve({ kind: 'wav', wav: encodeWav(pcm, TARGET_RATE), ms: Math.round(elapsedMs) })
    }

    options.stop?.addEventListener('abort', finish, { once: true })
    const hardStop = window.setTimeout(finish, MAX_MS + PREROLL_MS)

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      const frameMs = (input.length / ctx.sampleRate) * 1000
      elapsedMs += frameMs
      if (elapsedMs < PREROLL_MS) return
      chunks.push(new Float32Array(input))
      const level = rms(input)
      options.onLevel?.(level)
      if (level >= SPEECH_RMS) {
        heardSpeech = true
        silentMs = 0
      } else if (heardSpeech) {
        silentMs += frameMs
        if (silentMs >= SILENCE_MS) {
          window.clearTimeout(hardStop)
          finish()
        }
      }
    }

    source.connect(processor)
    processor.connect(sink)
    sink.connect(ctx.destination)
  })

  return result
}
