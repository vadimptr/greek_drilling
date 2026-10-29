import Anthropic from '@anthropic-ai/sdk'
import { ProviderError, type FactMatcher, type LevelChecker, type ScenarioGenerator, type Translator } from './providers.ts'
import { langOf, logicRules, SCENARIO_SCHEMA, scenarioRequest, validateScenario, type Lang, type Level, type Scenario, type TimeOfDay } from './scenario.ts'
import { LANGUAGE_EN, settingOf } from './settings.ts'

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

  const once = async (level: Level, recentGoals: string[], problems: string[], time: TimeOfDay | undefined, lang: Lang): Promise<Scenario> => {
    const response = await ask(client, STORY_MODEL, {
      max_tokens: 16000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCENARIO_SCHEMA } },
      messages: [{ role: 'user', content: scenarioRequest(level, recentGoals, problems, time, lang) }],
    })
    if (response.stop_reason === 'refusal') throw new ProviderError('Claude refused to write a scenario')
    if (response.stop_reason === 'max_tokens') throw new ProviderError('Claude scenario was cut off')
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    return validateScenario(JSON.parse(text), lang)
  }

  const review = async (s: Scenario): Promise<Review> => {
    const response = await ask(client, HELPER_MODEL, {
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: REVIEW_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: `You are the story editor of a language-learning game. A tourist who ${settingOf(langOf(s)).arrival} in ${settingOf(langOf(s)).city} completes a quest by talking to townspeople in ${LANGUAGE_EN[langOf(s)]}.

${settingOf(langOf(s)).lore}

Check this quest for logic problems only:
${logicRules(langOf(s))}

Quest (JSON):
${JSON.stringify(s)}

Is it logical and consistent? ok=true if there are no real problems. Otherwise ok=false and list each problem in one short English sentence, concrete enough to fix (e.g. "The goal asks to send a postcard to ${settingOf(langOf(s)).city}, but the player is already there"). Ignore style, wording and small details.`,
        },
      ],
    })
    if (response.stop_reason === 'refusal') return { ok: true, problems: [] }
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const parsed = JSON.parse(text) as Partial<Review>
    return { ok: parsed.ok !== false, problems: Array.isArray(parsed.problems) ? parsed.problems.filter((p) => typeof p === 'string') : [] }
  }

  return {
    async generate(level, recentGoals, time, lang = 'el') {
      let last: unknown
      for (let i = 0; i < ATTEMPTS; i++) {
        try {
          const s = await draftAndReview((problems) => once(level, recentGoals, problems, time, lang), review, 3)
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
  required: ['fact_ids', 'people_ids'],
  properties: { fact_ids: { type: 'array', items: { type: 'string' } }, people_ids: { type: 'array', items: { type: 'string' } } },
} as const

export function claudeFacts(apiKey: string): FactMatcher {
  const client = new Anthropic({ apiKey, timeout: 60_000 })
  return {
    async match(speaker, lines, facts, people, lang = 'el') {
      const transcript = lines.map((l) => `${l.role === 'agent' ? speaker : 'Tourist'}: ${l.text}`).join('\n')
      const list = facts.length ? facts.map((f) => `- ${f.id}: ${f.text}`).join('\n') : '- none'
      const others = people.length ? people.map((p) => `- ${p.id}: ${p.name}`).join('\n') : '- none'
      const response = await ask(client, HELPER_MODEL, {
        max_tokens: 4000,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: MATCH_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: `Here is a spoken conversation in ${LANGUAGE_EN[lang]} between a tourist and ${speaker} (speech recognition may contain small errors).

${transcript}

Facts:
${list}

People of the town:
${others}

1. fact_ids: which of these facts did ${speaker} actually communicate to the tourist (said it, or clearly confirmed the tourist's guess)? A fact counts only if its key content was really said.
2. people_ids: which of these people did ${speaker} actually tell the tourist about — who the person is or where to find them? A bare mention of a name (in a greeting, a joke, regards) does not count.
Return ids; empty lists if none.`,
          },
        ],
      })
      if (response.stop_reason === 'refusal') throw new ProviderError('Claude refused to match facts')
      const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
      const parsed = JSON.parse(text) as { fact_ids?: unknown; people_ids?: unknown }
      const pick = (raw: unknown, allowed: Set<string>) =>
        Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string' && allowed.has(id)) : []
      return { facts: pick(parsed.fact_ids, new Set(facts.map((f) => f.id))), people: pick(parsed.people_ids, new Set(people.map((p) => p.id))) }
    },
  }
}

const MANY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: { items: { type: 'array', items: { type: 'string' } } },
} as const

export function claudeTranslator(apiKey: string): Translator {
  const client = new Anthropic({ apiKey, timeout: 60_000 })
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
    translate: (text, to, from) =>
      run(
        `Translate the ${from ? `${LANGUAGE_EN[from]} ` : ''}phrase from a spoken conversation into natural ${LANGUAGE_EN[to]}. The phrase may have small speech recognition errors or mixed languages. Reply with the translation only, no quotes or comments.`,
        text,
      ),
    async translateMany(texts, to) {
      if (!texts.length) return []
      const response = await ask(client, HELPER_MODEL, {
        max_tokens: 8000,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: MANY_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: `Translate each item into simple, natural ${LANGUAGE_EN[to]} for a language learner's game (names of people and places: transliterate them into the ${LANGUAGE_EN[to]} alphabet). Return items in the same order, exactly ${texts.length} of them.\n\n${JSON.stringify(texts)}`,
          },
        ],
      })
      if (response.stop_reason === 'refusal') throw new ProviderError('Claude refused to translate')
      const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
      const items = (JSON.parse(text) as { items?: unknown }).items
      if (!Array.isArray(items) || items.length !== texts.length) throw new ProviderError('translation: wrong number of items')
      return items.map((x) => String(x))
    },
  }
}

const REASONS: Record<Lang, string> = {
  ru: '«слишком длинная реплика: 4 предложения», «редкое слово "…"»',
  en: '"too long: 4 sentences", "rare word \'…\'"',
  el: '«πολύ μεγάλη απάντηση: 4 προτάσεις», «σπάνια λέξη "…"»',
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
        required: ['index', 'reason', 'note_en'],
        properties: { index: { type: 'integer' }, reason: { type: 'string' }, note_en: { type: 'string' } },
      },
    },
  },
} as const

export function claudeLevels(apiKey: string): LevelChecker {
  const client = new Anthropic({ apiKey, timeout: 60_000 })
  return {
    async check(level, lines, lang = 'el', hint = 'ru') {
      const list = lines.map((l, i) => `${i}: ${l}`).join('\n')
      const response = await ask(client, HELPER_MODEL, {
        max_tokens: 6000,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: LEVEL_SCHEMA } },
        messages: [
          {
            role: 'user',
            content: `A ${LANGUAGE_EN[lang]}-speaking character talks to a learner of ${LANGUAGE_EN[lang]} whose level is CEFR ${level}. Rules for the character at this level:
${settingOf(lang).levelRules}

Character's replies (numbered):
${list}

List only the replies that are clearly too difficult for ${level} or break the rules (too long, grammar above the level, rare words, wrong form of address). For each: index, reason — a short reason in ${LANGUAGE_EN[hint]} naming the exact word or form (e.g. ${REASONS[hint]}), note_en — a short instruction in English for the character to avoid it next time. Ignore small things. Return an empty list if all replies fit.`,
          },
        ],
      })
      if (response.stop_reason === 'refusal') throw new ProviderError('Claude refused to check the level')
      const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
      const parsed = JSON.parse(text) as { issues?: { index: number; reason: string; note_en: string }[] }
      return (parsed.issues ?? []).filter((x) => Number.isInteger(x.index) && x.index >= 0 && x.index < lines.length)
    },
  }
}
