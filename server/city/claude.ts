import Anthropic from '@anthropic-ai/sdk'
import { ProviderError, type FactMatcher, type LevelChecker, type TouristNotes, type ScenarioGenerator, type Translator } from './providers.ts'
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
  const run = async (system: string, text: string) => {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: text }],
    })
    if (response.stop_reason === 'refusal') throw new ProviderError('Claude refused to translate')
    return response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim()
  }
  return {
    toRussian: (greek) =>
      run(
        'Translate the Greek phrase from a spoken conversation into natural Russian. The phrase may have small speech recognition errors or mixed languages. Reply with the translation only, no quotes or comments.',
        greek,
      ),
    toGreek: (russian) =>
      run(
        'Translate the Russian text into simple, natural modern Greek for a learner (A2 level). Keep names as they are in Greek. Reply with the translation only, no quotes or comments.',
        russian,
      ),
  }
}

const LEVEL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issues'],
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'reason_ru', 'note_en'],
        properties: { index: { type: 'integer' }, reason_ru: { type: 'string' }, note_en: { type: 'string' } },
      },
    },
  },
} as const

export function claudeLevels(apiKey: string): LevelChecker {
  const client = new Anthropic({ apiKey, timeout: 60_000 })
  return {
    async check(level, lines) {
      const list = lines.map((l, i) => `${i}: ${l}`).join('\n')
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 6000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: LEVEL_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: `A Greek-speaking character talks to a learner of Greek whose level is CEFR ${level}. Rules for the character at this level:
- A1: one short sentence (≤ 8 words) per reply, present tense / imperative / «θέλω να» only, the most frequent everyday words.
- A2: 1-2 short sentences (≤ 12 words each), present, aorist, future with «θα», imperative, simple «να» clauses; no perfect, no passive.
- B1: up to 2-3 sentences, everyday speech, no rare words or idioms.
Always informal «εσύ».

Character's replies (numbered):
${list}

List only the replies that are clearly too difficult for ${level} or break the rules (too long, grammar above the level, rare words, formal «εσείς»). For each: index, reason_ru — a short reason in Russian naming the exact word or form («перфект "έχεις κάψει"», «слишком длинная реплика: 4 предложения», «редкое слово "αγχώνομαι"»), note_en — a short instruction in English for the character to avoid it next time. Ignore small things. Return an empty list if all replies fit.`,
          },
        ],
      })
      if (response.stop_reason === 'refusal') throw new ProviderError('Claude refused to check the level')
      const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
      const parsed = JSON.parse(text) as { issues?: { index: number; reason_ru: string; note_en: string }[] }
      return (parsed.issues ?? []).filter((x) => Number.isInteger(x.index) && x.index >= 0 && x.index < lines.length)
    },
  }
}

const NOTES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['notes'],
  properties: { notes: { type: 'array', items: { type: 'string' } } },
} as const

export function claudeTouristNotes(apiKey: string): TouristNotes {
  const client = new Anthropic({ apiKey, timeout: 60_000 })
  return {
    async extract(lines, known) {
      const transcript = lines.map((l) => `${l.role === 'agent' ? 'Resident' : 'Tourist'}: ${l.text}`).join('\n')
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 2000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: NOTES_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: `A spoken conversation in Greek between a tourist and a resident of a small town (speech recognition may contain errors):

${transcript}

Already known about the tourist:
${known.length ? known.map((k) => `- ${k}`).join('\n') : '- nothing'}

List NEW facts the tourist clearly said about themselves (name, where they are from, job, why they came, how long they stay, family, likes...). Short English notes like "Name: Vadim", "From Saint Petersburg, Russia". Skip anything uncertain or already known. Return an empty list if nothing new.`,
          },
        ],
      })
      if (response.stop_reason === 'refusal') return []
      const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
      const parsed = JSON.parse(text) as { notes?: unknown }
      return Array.isArray(parsed.notes) ? parsed.notes.filter((n): n is string => typeof n === 'string' && n.length < 200).slice(0, 8) : []
    },
  }
}
