/** Отправка WAV на сервер распознавания (nginx → whisper-server /inference). */

export const TRANSCRIBE_URL = '/api/transcribe'
export const TRANSCRIBE_TIMEOUT_MS = 30_000

export class TranscribeError extends Error {
  constructor(
    public readonly kind: 'unavailable',
    message: string,
  ) {
    super(message)
  }
}

export async function transcribe(wav: ArrayBuffer): Promise<string> {
  const form = new FormData()
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'speech.wav')
  form.append('response_format', 'json')
  form.append('language', 'el')
  form.append('temperature', '0')

  let res: Response
  try {
    res = await fetch(TRANSCRIBE_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS) })
  } catch (e) {
    throw new TranscribeError('unavailable', `network: ${String(e)}`)
  }
  if (!res.ok) throw new TranscribeError('unavailable', `http ${res.status}`)

  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new TranscribeError('unavailable', 'bad json')
  }
  const text = typeof data === 'object' && data !== null ? (data as { text?: unknown }).text : undefined
  if (typeof text !== 'string') throw new TranscribeError('unavailable', 'no text')
  return text.trim()
}
