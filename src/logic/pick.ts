import type { Word } from '../types/word'
import type { Progress } from './state'

export const DUE_PROBABILITY = 0.8

export type Rng = () => number

export function pickNext(state: Progress, words: Word[], rng: Rng = Math.random): Word | null {
  const learned = new Set(state.learned)
  const weakSet = new Set(Object.keys(state.weak).map(Number))

  const fresh = words.filter((w) => !learned.has(w.id) && !weakSet.has(w.id))
  const weak = words.filter((w) => weakSet.has(w.id))
  const due = weak.filter((w) => state.weak[w.id] <= 0)
  const waiting = weak.filter((w) => state.weak[w.id] > 0)
  const soonest = Math.min(...waiting.map((w) => state.weak[w.id]))
  const next = waiting.filter((w) => state.weak[w.id] === soonest)

  const dueFirst = due.length > 0 && (fresh.length === 0 || rng() < DUE_PROBABILITY)
  const pools = dueFirst ? [due, fresh, next] : [fresh, due, next]

  for (const pool of pools) {
    const options = pool.filter((w) => w.id !== state.lastId)
    if (options.length > 0) return options[Math.floor(rng() * options.length)]
  }
  return words.find((w) => w.id === state.lastId && (weakSet.has(w.id) || !learned.has(w.id))) ?? null
}
