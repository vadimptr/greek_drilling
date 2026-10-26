import type { Level, Word } from '../types/word'
import { WORDS } from './words'
import { WORDS_A2 } from './words-a2'
import { WORDS_B1 } from './words-b1'

export const ALL_WORDS: Word[] = [...WORDS, ...WORDS_A2, ...WORDS_B1]

const POOLS: Record<Level, Word[]> = {
  A1: WORDS,
  A2: [...WORDS, ...WORDS_A2],
  B1: ALL_WORDS,
}

export function wordPool(level: Level): Word[] {
  return POOLS[level]
}
