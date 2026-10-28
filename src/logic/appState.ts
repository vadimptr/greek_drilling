import type { GrammarState } from '../types/grammar'
import type { MockAttempt, MockState } from '../types/mock'
import type { Word } from '../types/word'
import { initialGrammarState } from './lesson'
import { AORIST_WORDS } from './aorist'
import { initialMockState } from './mock'
import { initialSpeakState, type SpeakState } from './speakState'
import { initialSpellState, type SpellState } from './spell'
import { initialState as initialWords, type RoundState } from './state'
import { deserialize as deserializeWords, STORAGE_KEY as WORDS_V1_KEY } from './storage'

export type Tab = 'words' | 'grammar' | 'mock' | 'speak' | 'spell' | 'city'

/** Что показывать в разделе «Речь»: греческое слово с переводом или только перевод. */
export type SpeakHint = 'el' | 'ru'

/** Подраздел вкладки «Грамматика»: уроки, тренажёр склонения или аорист. */
export type GrammarSub = 'lessons' | 'nouns' | 'aorist'

export interface AppState {
  version: 3
  tab: Tab
  words: RoundState
  grammar: GrammarState
  mock: MockState
  speak: SpeakState
  speakHint: SpeakHint
  spell: SpellState
  /** Прогресс тренажёра склонения (ключи — id слов). */
  nouns: SpeakState
  /** Прогресс раздела «Аорист» (ключи — id глаголов из data/aorist). */
  aorist: SpeakState
  grammarSub: GrammarSub
  citySpeed: number
  cityAmbience: number
}

export const CITY_SPEEDS = [0.7, 0.8, 0.9, 1, 1.1, 1.2]
export const DEFAULT_CITY_SPEED = 0.9
export const CITY_AMBIENCE_LEVELS = [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1]
export const DEFAULT_CITY_AMBIENCE = 0.3

export const APP_STORAGE_KEY = 'greek_drilling.v3'
/** Предыдущий ключ: формат совместим, читается как есть, если v3 ещё не сохранялся. */
export const APP_V2_KEY = 'greek_drilling.v2'
export const USER_CACHE_KEY = 'greek_drilling.v3.user'
export const USER_HINT_KEY = 'greek_drilling.user'

export function initialAppState(): AppState {
  return {
    version: 3,
    tab: 'words',
    words: initialWords(),
    grammar: initialGrammarState(),
    mock: initialMockState(),
    speak: initialSpeakState(),
    speakHint: 'el',
    spell: initialSpellState(),
    nouns: initialSpeakState(),
    aorist: initialSpeakState(),
    grammarSub: 'lessons',
    citySpeed: DEFAULT_CITY_SPEED,
    cityAmbience: DEFAULT_CITY_AMBIENCE,
  }
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

/** Прогресс без настроек направления — общий парсер для «Речи» и «Письма». */
function parseProgress(raw: unknown, words: Word[]): SpeakState {
  if (!isObj(raw)) return initialSpeakState()
  const { learned, weak, score, bestStreak, lastId } = deserializeWords(JSON.stringify(raw), words)
  return { learned, weak, score, bestStreak, lastId }
}

/**
 * Разбирает состояние v3 (или совместимое v2: без speak/speakHint). Если его нет, мигрирует
 * прогресс слов из v1. Любой мусор превращается в начальное состояние соответствующего раздела.
 */
export function deserializeApp(
  rawApp: string | null,
  rawV1: string | null,
  words: Word[],
  lessonIds: number[],
): AppState {
  const ids = new Set(lessonIds)
  if (rawApp === null) {
    return { ...initialAppState(), words: deserializeWords(rawV1, words) }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(rawApp)
  } catch {
    return initialAppState()
  }
  if (!isObj(parsed)) return initialAppState()

  const tab: Tab =
    parsed.tab === 'grammar' || parsed.tab === 'mock' || parsed.tab === 'speak' || parsed.tab === 'spell' || parsed.tab === 'city'
      ? parsed.tab
      : 'words'
  return {
    version: 3,
    tab,
    words: deserializeWords(isObj(parsed.words) ? JSON.stringify(parsed.words) : null, words),
    grammar: parseGrammar(parsed.grammar, ids),
    mock: parseMock(parsed.mock),
    speak: parseProgress(parsed.speak, words),
    speakHint: parsed.speakHint === 'ru' ? 'ru' : 'el',
    spell: parseProgress(parsed.spell, words),
    nouns: parseProgress(parsed.nouns, words),
    aorist: parseProgress(parsed.aorist, AORIST_WORDS),
    grammarSub: parsed.grammarSub === 'nouns' || parsed.grammarSub === 'aorist' ? parsed.grammarSub : 'lessons',
    citySpeed: CITY_SPEEDS.find((v) => v === parsed.citySpeed) ?? DEFAULT_CITY_SPEED,
    cityAmbience: CITY_AMBIENCE_LEVELS.find((v) => v === parsed.cityAmbience) ?? DEFAULT_CITY_AMBIENCE,
  }
}

type Reader = Pick<Storage, 'getItem'>
type Writer = Pick<Storage, 'setItem'>

export function loadApp(storage: Reader, words: Word[], lessonIds: number[]): AppState {
  try {
    const rawApp = storage.getItem(APP_STORAGE_KEY) ?? storage.getItem(APP_V2_KEY)
    return deserializeApp(rawApp, storage.getItem(WORDS_V1_KEY), words, lessonIds)
  } catch {
    return initialAppState()
  }
}

export function loadUserCache(storage: Reader, words: Word[], lessonIds: number[]): AppState {
  try {
    return deserializeApp(storage.getItem(USER_CACHE_KEY), null, words, lessonIds)
  } catch {
    return initialAppState()
  }
}

export function parseRemote(state: unknown, words: Word[], lessonIds: number[]): AppState | null {
  return state === null || state === undefined ? null : deserializeApp(JSON.stringify(state), null, words, lessonIds)
}

export function saveApp(storage: Writer, state: AppState, key: string = APP_STORAGE_KEY): void {
  try {
    storage.setItem(key, serializeApp(state))
  } catch {
    // localStorage недоступен — прогресс не сохранится
  }
}
