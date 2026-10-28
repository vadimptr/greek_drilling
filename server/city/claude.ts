import Anthropic from '@anthropic-ai/sdk'
import { ProviderError, type FactMatcher, type ScenarioGenerator, type Translator } from './providers.ts'
import { SCENARIO_SCHEMA, scenarioRequest, validateScenario, type Level, type Scenario } from './scenario.ts'

const MODEL = 'claude-opus-5-5'
const ATTEMPTS = 2

export function claudeScenarios(apiKey: string): ScenarioGenerator {
  const client = new Anthropic({ apiKey, timeout: 90_000 })

  const once = async (level: Level, recentGoals: string[]): Promise<Scenario> => {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCENARIO_SCHEMA } },
      messages: [{ role: 'user', content: scenarioRequest(level, recentGoals) }],
    })
    if (response.stop_reason === 'refusal') throw new ProviderError('Claude refused to write a scenario')
    if (response.stop_reason === 'max_tokens') throw new ProviderError('Claude scenario was cut off')
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    return validateScenario(JSON.parse(text))
  }

  return {
    async generate(level, recentGoals) {
      let last: unknown
      for (let i = 0; i < ATTEMPTS; i++) {
        try {
          return await once(level, recentGoals)
        } catch (e) {
          last = e
          if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) break
        }
      }
      throw new ProviderError(`scenario generation failed: ${last instanceof Error ? last.message : String(last)}`)
    },
  }
}

const MATCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['fact_ids'],
  properties: { fact_ids: { type: 'array', items: { type: 'string' } } },
} as const

export function claudeFacts(apiKey: string): FactMatcher {
  const client = new Anthropic({ apiKey, timeout: 60_000 })
  return {
    async match(speaker, lines, facts) {
      const transcript = lines.map((l) => `${l.role === 'agent' ? speaker : 'Tourist'}: ${l.text}`).join('\n')
      const list = facts.map((f) => `- ${f.id}: ${f.text}`).join('\n')
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: MATCH_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: `Here is a spoken conversation in Greek between a tourist and ${speaker} (speech recognition may contain small errors).

${transcript}

Facts:
${list}

Which of these facts did ${speaker} actually communicate to the tourist in this conversation (said it, or clearly confirmed the tourist's guess)? A fact counts only if its key content was really said. Return their ids; return an empty list if none.`,
          },
        ],
      })
      if (response.stop_reason === 'refusal') throw new ProviderError('Claude refused to match facts')
      const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
      const parsed = JSON.parse(text) as { fact_ids?: unknown }
      const known = new Set(facts.map((f) => f.id))
      return Array.isArray(parsed.fact_ids) ? parsed.fact_ids.filter((id): id is string => typeof id === 'string' && known.has(id)) : []
    },
  }
}

export function claudeTranslator(apiKey: string): Translator {
  const client = new Anthropic({ apiKey, timeout: 30_000 })
  return {
    async toRussian(greek) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 2000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: 'Translate the Greek phrase from a spoken conversation into natural Russian. The phrase may have small speech recognition errors or mixed languages. Reply with the translation only, no quotes or comments.',
        messages: [{ role: 'user', content: greek }],
      })
      if (response.stop_reason === 'refusal') throw new ProviderError('Claude refused to translate')
      return response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim()
    },
  }
}
