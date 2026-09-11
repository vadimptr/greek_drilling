import type { Word } from '../types/word'
import type { Progress } from './state'
import type { Rng } from './pick'

/** Задания на орфографию: пропущенная, лишняя или неправильная буква. Все функции чистые. */

export type SpellKind = 'missing' | 'extra' | 'wrong'

export interface SpellTask {
  kind: SpellKind
  word: Word
  /** Показываемые графемы (для missing на месте пропуска — ''). */
  tokens: string[]
  /** Индексы, тап по которым (или заполнение которых) считается верным. */
  answerIndices: number[]
  /** Верная буква (для missing — что стоит в пропуске, для wrong — что должно быть, для extra — лишняя). */
  correctLetter: string
  /** Только для missing: 4 варианта. */
  options?: string[]
}

export type SpellState = Progress

export function initialSpellState(): SpellState {
  return { learned: [], weak: {}, score: 0, bestStreak: 0, lastId: null }
}

const ARTICLES = new Set(['ο', 'η', 'το', 'οι', 'τα'])
const ALPHABET = [...'αβγδεζηθικλμνξοπρστυφχψω']
const VOWELS = new Set([...'αεηιουω'])
const TONOS: Record<string, string> = { α: 'ά', ε: 'έ', η: 'ή', ι: 'ί', ο: 'ό', υ: 'ύ', ω: 'ώ' }
const BASE: Record<string, string> = { ά: 'α', έ: 'ε', ή: 'η', ί: 'ι', ό: 'ο', ύ: 'υ', ώ: 'ω', ϊ: 'ι', ϋ: 'υ', ΐ: 'ι', ΰ: 'υ' }
const HAS_TONOS = new Set([...'άέήίόύώΐΰ'])

/** Пары/группы букв, которые путают на письме (омофоны и созвучные). */
const GROUPS: string[][] = [
  ['ο', 'ω'],
  ['ι', 'η', 'υ'],
  ['ν', 'μ'],
  ['κ', 'χ'],
  ['τ', 'θ'],
  ['π', 'β'],
  ['δ', 'θ'],
  ['σ', 'ζ'],
  ['λ', 'ρ'],
  ['γ', 'χ'],
]

export function graphemes(s: string): string[] {
  return Array.from(s.normalize('NFC'))
}

export function baseLetter(g: string): string {
  return BASE[g] ?? g
}

/** Буква `base` с таким же ударением, как у `like`. */
export function sameAccent(base: string, like: string): string {
  return HAS_TONOS.has(like) ? TONOS[base] ?? base : base
}

export function confusablesOf(letter: string): string[] {
  const base = baseLetter(letter)
  const out: string[] = []
  for (const group of GROUPS) {
    if (!group.includes(base)) continue
    for (const x of group) if (x !== base && !out.includes(x)) out.push(x)
  }
  return out.map((x) => sameAccent(x, letter))
}

const isLetter = (g: string) => /\p{Script=Greek}/u.test(g) && /\p{L}/u.test(g)

/** Индексы букв, которые можно искажать: без артикля, пробелов и знаков. */
export function targetPositions(tokens: string[]): number[] {
  let start = 0
  const space = tokens.indexOf(' ')
  if (space > 0 && ARTICLES.has(tokens.slice(0, space).join(''))) start = space + 1
  const out: number[] = []
  for (let i = start; i < tokens.length; i++) if (isLetter(tokens[i])) out.push(i)
  return out
}

function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))]
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makeMissing(word: Word, tokens: string[], positions: number[], rng: Rng): SpellTask {
  const idx = pick(positions, rng)
  const correct = tokens[idx]
  const shown = [...tokens]
  shown[idx] = ''
  const options = [correct, ...confusablesOf(correct)].slice(0, 4)
  const pool = shuffle(
    ALPHABET.map((x) => sameAccent(x, correct)).filter((x) => !options.includes(x)),
    rng,
  )
  while (options.length < 4) options.push(pool.pop() as string)
  return { kind: 'missing', word, tokens: shown, answerIndices: [idx], correctLetter: correct, options: shuffle(options, rng) }
}

function makeWrong(word: Word, tokens: string[], positions: number[], rng: Rng): SpellTask | null {
  const candidates = positions.filter((i) => confusablesOf(tokens[i]).length > 0)
  if (candidates.length === 0) return null
  const idx = pick(candidates, rng)
  const correct = tokens[idx]
  const shown = [...tokens]
  shown[idx] = pick(confusablesOf(correct), rng)
  return { kind: 'wrong', word, tokens: shown, answerIndices: [idx], correctLetter: correct }
}

function makeExtra(word: Word, tokens: string[], positions: number[], rng: Rng): SpellTask {
  const idx = pick(positions, rng)
  const letter = tokens[idx]
  const base = baseLetter(letter)
  let inserted: string
  if (!VOWELS.has(base) && base !== 'ς') {
    inserted = base // удвоенная согласная: «θάλλασα», «καλλημέρα»
  } else {
    const alts = confusablesOf(letter).map(baseLetter).filter((x) => x !== base)
    inserted = alts.length > 0 ? pick(alts, rng) : pick(['ι', 'η', 'ε', 'ο'].filter((x) => x !== base), rng)
  }
  const shown = [...tokens.slice(0, idx + 1), inserted, ...tokens.slice(idx + 1)]
  const original = tokens.join('')
  const answerIndices: number[] = []
  for (let i = 0; i < shown.length; i++) {
    if (shown.filter((_, j) => j !== i).join('') === original) answerIndices.push(i)
  }
  return { kind: 'extra', word, tokens: shown, answerIndices, correctLetter: inserted }
}

export function makeSpellTask(word: Word, rng: Rng = Math.random): SpellTask {
  const tokens = graphemes(word.el)
  const positions = targetPositions(tokens)
  const r = rng()
  if (r >= 2 / 3) {
    const task = makeWrong(word, tokens, positions, rng)
    if (task) return task
  } else if (r >= 1 / 3) {
    return makeExtra(word, tokens, positions, rng)
  }
  return makeMissing(word, tokens, positions, rng)
}

export function checkSpell(task: SpellTask, answer: { index?: number; option?: string }): boolean {
  if (task.kind === 'missing') return answer.option !== undefined && answer.option === task.correctLetter
  return answer.index !== undefined && task.answerIndices.includes(answer.index)
}
