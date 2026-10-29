import { ProviderError, type VoiceProvider } from './providers.ts'
import type { Age, Gender, Lang } from './scenario.ts'

export interface ElevenLabsConfig {
  apiKey: string
  agentId: string
  voices: Partial<Record<Lang, Voices>>
  speed: number
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

export function elevenLabsVoice(cfg: ElevenLabsConfig, fetchImpl: typeof fetch = fetch): VoiceProvider {
  return {
    id: 'elevenlabs',
    async open(persona) {
      const url = `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(cfg.agentId)}`
      const res = await fetchImpl(url, { headers: { 'xi-api-key': cfg.apiKey }, signal: AbortSignal.timeout(15_000) })
      if (!res.ok) throw new ProviderError(`elevenlabs token: HTTP ${res.status} ${await res.text().catch(() => '')}`)
      const { token } = (await res.json()) as { token?: string }
      if (!token) throw new ProviderError('elevenlabs token: empty response')
      const { gender, age, index, lang } = persona.voice
      const voiceId = pickVoice(cfg.voices[lang] ?? {}, gender, age, index)
      return {
        provider: 'elevenlabs',
        connection: {
          conversationToken: token,
          overrides: {
            agent: { prompt: { prompt: persona.systemPrompt }, firstMessage: persona.firstMessage, language: persona.language },
            tts: { ...(voiceId ? { voiceId } : {}), speed: persona.speed ?? cfg.speed },
            asr: { keywords: persona.keywords },
          },
        },
      }
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
