import Anthropic from '@anthropic-ai/sdk'
import { ProviderError, type ScenarioGenerator } from './providers.ts'
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
