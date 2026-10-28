import { ProviderError, type VoiceProvider } from './providers.ts'
import type { Age, Gender } from './scenario.ts'

export interface ElevenLabsConfig {
  apiKey: string
  agentId: string
  voices: Partial<Record<`${Gender}-${Age}` | Gender, string>>
  speed: number
}

export function parseVoices(raw: string | undefined): ElevenLabsConfig['voices'] {
  const voices: ElevenLabsConfig['voices'] = {}
  for (const pair of (raw ?? '').split(',')) {
    const [key, id] = pair.split('=').map((x) => x.trim())
    if (key && id && /^(male|female)(-(young|middle|old))?$/.test(key)) voices[key as keyof ElevenLabsConfig['voices']] = id
  }
  return voices
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
      const { gender, age } = persona.voice
      const voiceId = cfg.voices[`${gender}-${age}`] ?? cfg.voices[gender]
      return {
        provider: 'elevenlabs',
        connection: {
          conversationToken: token,
          overrides: {
            agent: { prompt: { prompt: persona.systemPrompt }, firstMessage: persona.firstMessage, language: persona.language },
            tts: { ...(voiceId ? { voiceId } : {}), speed: cfg.speed },
            asr: { keywords: persona.keywords },
          },
        },
      }
    },
  }
}
