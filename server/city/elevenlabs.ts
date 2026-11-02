import { ProviderError, type SpeechProvider } from './providers.ts'
import type { Age, Gender, Lang } from './scenario.ts'

export interface ElevenLabsConfig {
  apiKey: string
  voices: Partial<Record<Lang, Voices>>
  speed: number
  sttModel: string
  ttsModel: string
  fallbackVoice: string
}

type VoiceSlot = `${Gender}-${Age}` | Gender
export type Voices = Partial<Record<VoiceSlot, string[]>>

const AGE_FALLBACK: Record<Age, Age[]> = { young: ['young', 'middle', 'old'], middle: ['middle', 'young', 'old'], old: ['old', 'middle', 'young'] }

export function parseVoices(raw: string | undefined): Voices {
  const voices: Voices = {}
  for (const pair of (raw ?? '').split(',')) {
    const [key, ids] = pair.split('=').map((x) => x.trim())
    const list = (ids ?? '').split('|').map((x) => x.trim()).filter(Boolean)
    if (key && list.length && /^(male|female)(-(young|middle|old))?$/.test(key)) voices[key as VoiceSlot] = list
  }
  return voices
}

export function pickVoice(voices: Voices, gender: Gender, age: Age, index: number): string | undefined {
  const slots: VoiceSlot[] = [...AGE_FALLBACK[age].map((a): VoiceSlot => `${gender}-${a}`), gender]
  const list = slots.map((slot) => voices[slot]).find((l) => l && l.length)
  return list?.[index % list.length]
}

const STT_LANG: Record<Lang, string> = { el: 'ell', en: 'eng', ru: 'rus' }

async function failure(what: string, res: Response): Promise<ProviderError> {
  return new ProviderError(`elevenlabs ${what}: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`)
}

export function elevenLabsSpeech(cfg: ElevenLabsConfig, fetchImpl: typeof fetch = fetch): SpeechProvider {
  return {
    async transcribe(audio, type, lang) {
      const form = new FormData()
      form.append('model_id', cfg.sttModel)
      form.append('language_code', STT_LANG[lang])
      form.append('tag_audio_events', 'false')
      form.append('file', new Blob([new Uint8Array(audio)], { type }), 'speech')
      const res = await fetchImpl('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': cfg.apiKey },
        body: form,
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) throw await failure('speech-to-text', res)
      const data = (await res.json()) as { text?: string; words?: { end?: number }[] }
      const seconds = Math.max(0, ...(data.words ?? []).map((w) => w.end ?? 0))
      return { text: (data.text ?? '').trim(), seconds }
    },
    async speak(text, voice, speed) {
      const voiceId = pickVoice(cfg.voices[voice.lang] ?? {}, voice.gender, voice.age, voice.index) ?? cfg.fallbackVoice
      const res = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`, {
        method: 'POST',
        headers: { 'xi-api-key': cfg.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: cfg.ttsModel, language_code: voice.lang, voice_settings: { speed: speed ?? cfg.speed } }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) throw await failure('text-to-speech', res)
      return { audio: Buffer.from(await res.arrayBuffer()), chars: text.length }
    },
  }
}

export async function dropModeratedVoices(cfg: ElevenLabsConfig, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const dropped: string[] = []
  const slots = Object.values(cfg.voices).flatMap((voices) => (Object.entries(voices) as [VoiceSlot, string[]][]).map(([slot, ids]) => ({ voices, slot, ids })))
  for (const { voices, slot, ids } of slots) {
    const usable: string[] = []
    for (const id of ids) {
      try {
        const res = await fetchImpl(`https://api.elevenlabs.io/v1/voices/${id}`, { headers: { 'xi-api-key': cfg.apiKey } })
        const v = res.ok ? ((await res.json()) as { sharing?: { live_moderation_enabled?: boolean } }) : null
        if (!res.ok || v?.sharing?.live_moderation_enabled) dropped.push(id)
        else usable.push(id)
      } catch {
        usable.push(id)
      }
    }
    if (usable.length) voices[slot] = usable
    else delete voices[slot]
  }
  return dropped
}
