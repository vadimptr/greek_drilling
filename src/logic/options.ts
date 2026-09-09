import type { Direction, Word } from '../types/word'
import type { Rng } from './pick'

export const OPTION_COUNT = 4

/** Текст варианта ответа для данного направления. */
export function labelOf(word: Word, direction: Direction): string {
  return direction === 'el-ru' ? word.ru : word.el
}

/** Текст вопроса (то, что показываем по центру). */
export function promptOf(word: Word, direction: Direction): string {
  return direction === 'el-ru' ? word.el : word.ru
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function buildOptions(
  target: Word,
  words: Word[],
  direction: Direction,
  rng: Rng = Math.random,
): Word[] {
  const used = new Set([labelOf(target, direction)])
  const candidates = words.filter((w) => w.id !== target.id)
  const samePos = shuffle(candidates.filter((w) => w.pos === target.pos), rng)
  const otherPos = shuffle(candidates.filter((w) => w.pos !== target.pos), rng)

  const picked: Word[] = []
  for (const w of [...samePos, ...otherPos]) {
    if (picked.length >= OPTION_COUNT - 1) break
    const label = labelOf(w, direction)
    if (used.has(label)) continue
    used.add(label)
    picked.push(w)
  }

  return shuffle([target, ...picked], rng)
}
