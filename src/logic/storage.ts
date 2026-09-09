import type { Direction, Word } from '../types/word'
import { initialState, type RoundState } from './state'

export const STORAGE_KEY = 'greek_drilling.v1'

type Reader = Pick<Storage, 'getItem'>
type Writer = Pick<Storage, 'setItem'>

export function serialize(state: RoundState): string {
  return JSON.stringify(state)
}

const isNonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

export function deserialize(raw: string | null, words: Word[]): RoundState {
  if (raw === null) return initialState()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return initialState()
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return initialState()

  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.learned)) return initialState()
  if (typeof obj.weak !== 'object' || obj.weak === null || Array.isArray(obj.weak)) return initialState()

  const known = new Set(words.map((w) => w.id))
  const direction: Direction = obj.direction === 'ru-el' ? 'ru-el' : 'el-ru'

  const learned = obj.learned.filter((id): id is number => isNonNegInt(id) && known.has(id))

  const weak: Record<number, number> = {}
  for (const [k, v] of Object.entries(obj.weak as Record<string, unknown>)) {
    const id = Number(k)
    if (known.has(id) && isNonNegInt(v) && v > 0) weak[id] = v
  }

  const score = isNonNegInt(obj.score) ? obj.score : 0
  const bestStreak = isNonNegInt(obj.bestStreak) ? obj.bestStreak : 0
  const lastId = isNonNegInt(obj.lastId) && known.has(obj.lastId) ? obj.lastId : null
  const autoSpeak = typeof obj.autoSpeak === 'boolean' ? obj.autoSpeak : true

  return { learned, weak, score, bestStreak, lastId, direction, autoSpeak }
}

export function loadState(storage: Reader, words: Word[]): RoundState {
  try {
    return deserialize(storage.getItem(STORAGE_KEY), words)
  } catch {
    return initialState()
  }
}

export function saveState(storage: Writer, state: RoundState): void {
  try {
    storage.setItem(STORAGE_KEY, serialize(state))
  } catch {
    // localStorage недоступен или переполнен — прогресс просто не сохранится
  }
}
