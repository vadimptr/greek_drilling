import type { Word } from '../types/word'
import type { Progress } from './state'

/** Вероятность взять слово из слабого списка, если есть и слабые, и новые. */
export const WEAK_PROBABILITY = 0.7

export type Rng = () => number

export function pickNext(state: Progress, words: Word[], rng: Rng = Math.random): Word | null {
  const learned = new Set(state.learned)
  const weakSet = new Set(Object.keys(state.weak).map(Number))

  const fresh = words.filter((w) => !learned.has(w.id) && !weakSet.has(w.id))
  const weak = words.filter((w) => weakSet.has(w.id))

  if (fresh.length === 0 && weak.length === 0) return null

  let useWeak: boolean
  if (weak.length === 0) useWeak = false
  else if (fresh.length === 0) useWeak = true
  else useWeak = rng() < WEAK_PROBABILITY

  let pool = useWeak ? weak : fresh
  const other = useWeak ? fresh : weak
  if (pool.length === 1 && pool[0].id === state.lastId && other.length > 0) {
    pool = other
  }
  if (pool.length > 1 && state.lastId !== null) {
    pool = pool.filter((w) => w.id !== state.lastId)
  }

  return pool[Math.floor(rng() * pool.length)]
}
