import type { NounEntry } from '../data/nouns'
import type { Rng } from './pick'

/** Задания на склонение существительных: определить форму или образовать другую. */

export type Gender = 'm' | 'f' | 'n'
export type Case = 'nom' | 'gen' | 'acc'
export type Num = 'sg' | 'pl'
export interface Analysis {
  c: Case
  n: Num
}

export const GENDERS: Gender[] = ['m', 'f', 'n']
export const CASES: Case[] = ['nom', 'gen', 'acc']
export const NUMS: Num[] = ['sg', 'pl']

export const GENDER_LABEL: Record<Gender, string> = { m: 'мужской', f: 'женский', n: 'средний' }
export const GENDER_SHORT: Record<Gender, string> = { m: 'м. р.', f: 'ж. р.', n: 'ср. р.' }
export const CASE_LABEL: Record<Case, string> = { nom: 'именительный', gen: 'родительный', acc: 'винительный' }
export const CASE_SHORT: Record<Case, string> = { nom: 'Им.', gen: 'Род.', acc: 'Вин.' }
export const NUM_LABEL: Record<Num, string> = { sg: 'единственное', pl: 'множественное' }
export const NUM_SHORT: Record<Num, string> = { sg: 'ед. ч.', pl: 'мн. ч.' }

export function genderOf(entry: NounEntry): Gender {
  const a = entry.el.split(' ')[0]
  return a === 'ο' ? 'm' : a === 'η' ? 'f' : 'n'
}

export function formIndex(c: Case, n: Num): number {
  return (n === 'pl' ? 3 : 0) + CASES.indexOf(c)
}

export function bareForm(entry: NounEntry, c: Case, n: Num): string {
  return entry.forms[formIndex(c, n)]
}

/** Перед гласными и κ π τ ξ ψ (и μπ ντ γκ τσ τζ) конечное ν в «την» сохраняется, иначе отпадает. */
function keepsNu(next: string): boolean {
  const s = next.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/^[αεηιουω]/.test(s)) return true
  if (/^(μπ|ντ|γκ|τσ|τζ)/.test(s)) return true
  return /^[κπτξψ]/.test(s)
}

export function article(g: Gender, c: Case, n: Num, next: string): string {
  if (g === 'm') return n === 'sg' ? { nom: 'ο', gen: 'του', acc: 'τον' }[c] : { nom: 'οι', gen: 'των', acc: 'τους' }[c]
  if (g === 'f') {
    if (n === 'sg') return c === 'nom' ? 'η' : c === 'gen' ? 'της' : keepsNu(next) ? 'την' : 'τη'
    return { nom: 'οι', gen: 'των', acc: 'τις' }[c]
  }
  return n === 'sg' ? { nom: 'το', gen: 'του', acc: 'το' }[c] : { nom: 'τα', gen: 'των', acc: 'τα' }[c]
}

export function withArticle(entry: NounEntry, c: Case, n: Num): string {
  const form = bareForm(entry, c, n)
  return `${article(genderOf(entry), c, n, form)} ${form}`
}

/** Все сочетания падеж/число, дающие ровно такую строку (с артиклем). */
export function analyses(entry: NounEntry, shown: string): Analysis[] {
  const out: Analysis[] = []
  for (const n of NUMS) for (const c of CASES) if (withArticle(entry, c, n) === shown) out.push({ c, n })
  return out
}

export function describeAnalyses(entry: NounEntry, list: Analysis[]): string {
  const g = GENDER_LABEL[genderOf(entry)]
  const cases = [...new Set(list.map((a) => a.c))].map((c) => CASE_LABEL[c]).join(' или ')
  const nums = [...new Set(list.map((a) => a.n))].map((n) => NUM_LABEL[n]).join(' или ')
  return `${g} род, ${cases} падеж, ${nums} число`
}

export interface IdentifyTask {
  kind: 'identify'
  entry: NounEntry
  shown: string
  valid: Analysis[]
}

export interface TransformTask {
  kind: 'transform'
  entry: NounEntry
  source: string
  sourceAnalysis: Analysis
  target: Analysis
  options: string[]
  answer: string
  answerIndex: number
}

export type NounTask = IdentifyTask | TransformTask

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

const ALL: Analysis[] = NUMS.flatMap((n) => CASES.map((c) => ({ c, n })))

export function makeNounTask(entry: NounEntry, rng: Rng = Math.random): NounTask {
  if (rng() < 0.5) {
    const a = pick(ALL, rng)
    const shown = withArticle(entry, a.c, a.n)
    return { kind: 'identify', entry, shown, valid: analyses(entry, shown) }
  }
  const src = pick(ALL, rng)
  const sourceBare = bareForm(entry, src.c, src.n)
  const targets = ALL.filter((t) => bareForm(entry, t.c, t.n) !== sourceBare)
  const target = pick(targets, rng)
  const answerIndex = formIndex(target.c, target.n)
  const answer = entry.forms[answerIndex]
  const others = shuffle([...new Set(entry.forms)].filter((f) => f !== answer), rng).slice(0, 3)
  return {
    kind: 'transform',
    entry,
    source: withArticle(entry, src.c, src.n),
    sourceAnalysis: src,
    target,
    options: shuffle([answer, ...others], rng),
    answer,
    answerIndex,
  }
}

export function checkIdentify(task: IdentifyTask, choice: { g: Gender; c: Case; n: Num }): boolean {
  return choice.g === genderOf(task.entry) && task.valid.some((a) => a.c === choice.c && a.n === choice.n)
}
