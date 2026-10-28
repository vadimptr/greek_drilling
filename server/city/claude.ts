import Anthropic from '@anthropic-ai/sdk'
import { ProviderError, type FactMatcher, type LevelChecker, type ScenarioGenerator, type Translator } from './providers.ts'
import { CITY_NAME, LOGIC_RULES, LORE, SCENARIO_SCHEMA, scenarioRequest, validateScenario, type Level, type Scenario, type TimeOfDay } from './scenario.ts'

const STORY_MODEL = process.env.CITY_STORY_MODEL || 'claude-opus-5-5'
const HELPER_MODEL = process.env.CITY_HELPER_MODEL || 'claude-haiku-5-5'
const WITH_FALLBACKS = /^claude-(opus|fable|sonnet)-/

type CreateParams = Parameters<Anthropic['beta']['messages']['create']>[0]

function ask(client: Anthropic, model: string, params: Omit<CreateParams, 'model' | 'betas' | 'fallbacks' | 'stream'>) {
  const extra = WITH_FALLBACKS.test(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}
  return client.beta.messages.create({ ...params, ...extra, model, stream: false })
}
const ATTEMPTS = 2

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'problems'],
  properties: { ok: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } } },
} as const

export interface Review {
  ok: boolean
  problems: string[]
}

export async function draftAndReview(
  draft: (problems: string[]) => Promise<Scenario>,
  review: (s: Scenario) => Promise<Review>,
  rounds: number,
): Promise<Scenario> {
  let problems: string[] = []
  let last: Scenario | null = null
  for (let i = 0; i < rounds; i++) {
    last = await draft(problems)
    const verdict = await review(last).catch(() => ({ ok: true, problems: [] }))
    if (verdict.ok || !verdict.problems.length) return last
    problems = verdict.problems
  }
  return last!
}

export function claudeScenarios(apiKey: string): ScenarioGenerator {
  const client = new Anthropic({ apiKey, timeout: 90_000 })

  const once = async (level: Level, recentGoals: string[], problems: string[], time?: TimeOfDay): Promise<Scenario> => {
    const response = await ask(client, STORY_MODEL, {
      max_tokens: 16000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCENARIO_SCHEMA } },
      messages: [{ role: 'user', content: scenarioRequest(level, recentGoals, problems, time) }],
    })
    if (response.stop_reason === 'refusal') throw new ProviderError('Claude refused to write a scenario')
    if (response.stop_reason === 'max_tokens') throw new ProviderError('Claude scenario was cut off')
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    return validateScenario(JSON.parse(text))
  }

  const review = async (s: Scenario): Promise<Review> => {
    const response = await ask(client, HELPER_MODEL, {
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: REVIEW_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: `You are the story editor of a language-learning game. A tourist who has just arrived in ${CITY_NAME} (a small fictional Greek harbour town) completes a quest by talking to townspeople.

${LORE}

Check this quest for logic problems only:
${LOGIC_RULES}

Quest (JSON):
${JSON.stringify(s)}

Is it logical and consistent? ok=true if there are no real problems. Otherwise ok=false and list each problem in one short English sentence, concrete enough to fix (e.g. "The goal asks to send a postcard to Μυθόπολη, but the player is already there"). Ignore style, wording and small details.`,
        },
      ],
    })
    if (response.stop_reason === 'refusal') return { ok: true, problems: [] }
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const parsed = JSON.parse(text) as Partial<Review>
    return { ok: parsed.ok !== false, problems: Array.isArray(parsed.problems) ? parsed.problems.filter((p) => typeof p === 'string') : [] }
  }

  return {
    async generate(level, recentGoals, time) {
      let last: unknown
      for (let i = 0; i < ATTEMPTS; i++) {
        try {
          const s = await draftAndReview((problems) => once(level, recentGoals, problems, time), review, 3)
          if (time) s.time_of_day = time
          return s
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
      const response = await ask(client, HELPER_MODEL, {
        max_tokens: 4000,
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
    const response = await ask(client, HELPER_MODEL, {
      max_tokens: 2000,
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
      const response = await ask(client, HELPER_MODEL, {
        max_tokens: 6000,
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
