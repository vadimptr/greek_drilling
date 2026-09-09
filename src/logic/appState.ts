import type { GrammarState } from '../types/grammar'
import type { MockAttempt, MockState } from '../types/mock'
import type { Word } from '../types/word'
import { initialGrammarState } from './lesson'
import { initialMockState } from './mock'
import { initialState as initialWords, type RoundState } from './state'
import { deserialize as deserializeWords, STORAGE_KEY as WORDS_V1_KEY } from './storage'

export type Tab = 'words' | 'grammar' | 'mock'

export interface AppState {
  version: 2
  tab: Tab
  words: RoundState
  grammar: GrammarState
  mock: MockState
}

export const APP_STORAGE_KEY = 'greek_drilling.v2'

export function initialAppState(): AppState {
  return { version: 2, tab: 'words', words: initialWords(), grammar: initialGrammarState(), mock: initialMockState() }
}

export function serializeApp(state: AppState): string {
  return JSON.stringify(state)
}

const isNonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function parseGrammar(raw: unknown, lessonIds: Set<number>): GrammarState {
  const init = initialGrammarState()
  if (!isObj(raw)) return init
  const completed = Array.isArray(raw.completed)
    ? raw.completed.filter((id): id is number => isNonNegInt(id) && lessonIds.has(id))
    : []
  let active: GrammarState['active'] = null
  if (isObj(raw.active) && isNonNegInt(raw.active.lessonId) && lessonIds.has(raw.active.lessonId)) {
    const queue = Array.isArray(raw.active.queue) ? raw.active.queue.filter((q): q is string => typeof q === 'string') : []
    if (queue.length > 0) active = { lessonId: raw.active.lessonId, queue }
  }
  return {
    completed,
    score: isNonNegInt(raw.score) ? raw.score : 0,
    bestStreak: isNonNegInt(raw.bestStreak) ? raw.bestStreak : 0,
    active,
  }
}

function parseMock(raw: unknown): MockState {
  const init = initialMockState()
  if (!isObj(raw)) return init
  const history: MockAttempt[] = Array.isArray(raw.history)
    ? raw.history.filter(
        (a): a is MockAttempt =>
          isObj(a) &&
          typeof a.date === 'string' &&
          isNonNegInt(a.variantId) &&
          typeof a.reading === 'number' &&
          typeof a.language === 'number' &&
          typeof a.passed === 'boolean',
      )
    : []
  return { history, nextVariant: isNonNegInt(raw.nextVariant) ? raw.nextVariant : 0 }
}

/**
 * Разбирает состояние v2. Если его нет, мигрирует прогресс слов из v1.
 * Любой мусор превращается в начальное состояние соответствующего раздела.
 */
export function deserializeApp(
  rawV2: string | null,
  rawV1: string | null,
  words: Word[],
  lessonIds: number[],
): AppState {
  const ids = new Set(lessonIds)
  if (rawV2 === null) {
    return { ...initialAppState(), words: deserializeWords(rawV1, words) }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(rawV2)
  } catch {
    return initialAppState()
  }
  if (!isObj(parsed)) return initialAppState()

  const tab: Tab = parsed.tab === 'grammar' || parsed.tab === 'mock' ? parsed.tab : 'words'
  return {
    version: 2,
    tab,
    words: deserializeWords(isObj(parsed.words) ? JSON.stringify(parsed.words) : null, words),
    grammar: parseGrammar(parsed.grammar, ids),
    mock: parseMock(parsed.mock),
  }
}

type Reader = Pick<Storage, 'getItem'>
type Writer = Pick<Storage, 'setItem'>

export function loadApp(storage: Reader, words: Word[], lessonIds: number[]): AppState {
  try {
    return deserializeApp(storage.getItem(APP_STORAGE_KEY), storage.getItem(WORDS_V1_KEY), words, lessonIds)
  } catch {
    return initialAppState()
  }
}

export function saveApp(storage: Writer, state: AppState): void {
  try {
    storage.setItem(APP_STORAGE_KEY, serializeApp(state))
  } catch {
    // localStorage недоступен — прогресс не сохранится
  }
}
