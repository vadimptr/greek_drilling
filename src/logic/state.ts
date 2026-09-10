import type { Direction, Word } from '../types/word'

export const WEAK_REPEATS = 3

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
}

export function initialState(direction: Direction = 'el-ru', autoSpeak = true): RoundState {
  return { learned: [], weak: {}, score: 0, bestStreak: 0, lastId: null, direction, autoSpeak }
}

function addUnique(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids : [...ids, id]
}

export function applyAnswer<S extends Progress>(state: S, wordId: number, correct: boolean): S {
  const weak = { ...state.weak }
  let learned = state.learned

  if (!correct) {
    weak[wordId] = WEAK_REPEATS
    learned = learned.filter((id) => id !== wordId)
    return { ...state, weak, learned, score: 0, lastId: wordId }
  }

  const score = state.score + 1
  if (wordId in weak) {
    const left = weak[wordId] - 1
    if (left <= 0) {
      delete weak[wordId]
      learned = addUnique(learned, wordId)
    } else {
      weak[wordId] = left
    }
  } else {
    learned = addUnique(learned, wordId)
  }

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
  if (Object.keys(state.weak).length > 0) return false
  const learned = new Set(state.learned)
  return words.every((w) => learned.has(w.id))
}

export function restart(state: RoundState): RoundState {
  return initialState(state.direction, state.autoSpeak)
}
