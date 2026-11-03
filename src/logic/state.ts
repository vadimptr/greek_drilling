import type { Direction, Level, Word } from '../types/word'
import type { Rng } from './pick'

export const WEAK_GAP_MIN = 3
export const WEAK_GAP_MAX = 5

/** Прогресс по словам — общая часть разделов «Слова» и «Речь». */
export interface Progress {
  learned: number[]
  weak: Record<number, number>
  score: number
  bestStreak: number
  lastId: number | null
}

export interface RoundState extends Progress {
  direction: Direction
  autoSpeak: boolean
  level: Level
}

export function initialState(direction: Direction = 'el-ru', autoSpeak = true, level: Level = 'A1'): RoundState {
  return { learned: [], weak: {}, score: 0, bestStreak: 0, lastId: null, direction, autoSpeak, level }
}

function addUnique(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids : [...ids, id]
}

export function weakGap(rng: Rng = Math.random): number {
  return WEAK_GAP_MIN + Math.floor(rng() * (WEAK_GAP_MAX - WEAK_GAP_MIN + 1))
}

export function tickWeak(weak: Record<number, number>, exceptId: number): Record<number, number> {
  const next: Record<number, number> = {}
  for (const [k, v] of Object.entries(weak)) {
    const id = Number(k)
    next[id] = id === exceptId ? v : Math.max(0, v - 1)
  }
  return next
}

export function applyAnswer<S extends Progress>(state: S, wordId: number, correct: boolean, rng: Rng = Math.random): S {
  const weak = tickWeak(state.weak, wordId)
  let learned = state.learned

  if (!correct) {
    weak[wordId] = weakGap(rng)
    learned = learned.filter((id) => id !== wordId)
    return { ...state, weak, learned, score: 0, lastId: wordId }
  }

  const score = state.score + 1
  delete weak[wordId]
  learned = addUnique(learned, wordId)

  return {
    ...state,
    weak,
    learned,
    score,
    bestStreak: Math.max(state.bestStreak, score),
    lastId: wordId,
  }
}

export function isWin(state: Progress, words: Word[]): boolean {
  const learned = new Set(state.learned)
  return words.every((w) => learned.has(w.id) && !(w.id in state.weak))
}

export function restart(state: RoundState): RoundState {
  return initialState(state.direction, state.autoSpeak, state.level)
}
