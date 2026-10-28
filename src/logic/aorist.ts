import { AORIST_SENTENCES, AORIST_VERBS, PRONOUNS, type AoristGroup, type AoristSentence, type AoristVerb } from '../data/aorist'
import type { Word } from '../types/word'
import type { Rng } from './pick'

export const OPTION_COUNT = 6

export type GroupFilter = AoristGroup | 'all'

export interface AoristTask {
  verb: AoristVerb
  person: number
  form: string
  options: string[]
  answer: string
}

const toWord = (v: AoristVerb): Word => ({ id: v.id, el: v.present, ru: v.ru, pos: 'verb', topic: 'aorist' })

export const AORIST_WORDS: Word[] = AORIST_VERBS.map(toWord)

export function aoristWords(filter: GroupFilter): Word[] {
  return filter === 'all' ? AORIST_WORDS : AORIST_VERBS.filter((v) => v.group === filter).map(toWord)
}

export function verbsOf(filter: GroupFilter): AoristVerb[] {
  return filter === 'all' ? AORIST_VERBS : AORIST_VERBS.filter((v) => v.group === filter)
}

const verbById = new Map(AORIST_VERBS.map((v) => [v.id, v]))

export function aoristVerb(id: number): AoristVerb | undefined {
  return verbById.get(id)
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function meaningKeys(ru: string): string[] {
  return ru
    .replace(/\([^)]*\)/g, '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function overlaps(a: string[], b: Set<string>): boolean {
  return a.some((k) => b.has(k))
}

function translationOptions(verb: AoristVerb, rng: Rng): string[] {
  const others = AORIST_VERBS.filter((v) => v.id !== verb.id)
  const pools = [shuffle(others.filter((v) => v.group === verb.group), rng), shuffle(others.filter((v) => v.group !== verb.group), rng)]
  const out = [verb.ru]
  const taken = new Set(meaningKeys(verb.ru))
  for (const pool of pools) {
    for (const v of pool) {
      if (out.length >= OPTION_COUNT) break
      const keys = meaningKeys(v.ru)
      if (out.includes(v.ru) || overlaps(keys, taken)) continue
      out.push(v.ru)
      keys.forEach((k) => taken.add(k))
    }
  }
  return shuffle(out, rng)
}

export function makeAoristTask(verb: AoristVerb, rng: Rng = Math.random): AoristTask {
  const person = Math.min(5, Math.floor(rng() * 6))
  return {
    verb,
    person,
    form: verb.forms[person],
    options: translationOptions(verb, rng),
    answer: verb.ru,
  }
}

export function personsOf(verb: AoristVerb, form: string): number[] {
  return verb.forms.flatMap((f, p) => (f === form ? [p] : []))
}

export function paradigm(verb: AoristVerb): string {
  return verb.forms.map((f, p) => `${PRONOUNS[p]} ${f}`).join(', ')
}

export function fillBlank(sentence: AoristSentence, form: string): string {
  const filled = sentence.el.replace('___', form)
  return sentence.el.startsWith('___') ? filled.charAt(0).toUpperCase() + filled.slice(1) : filled
}

export function sentencesOf(verbId: number): AoristSentence[] {
  return AORIST_SENTENCES.filter((s) => s.verb === verbId)
}
