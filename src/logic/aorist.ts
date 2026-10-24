import { AORIST_SENTENCES, AORIST_VERBS, PRONOUNS, PRONOUN_RU, type AoristSentence, type AoristVerb } from '../data/aorist'
import type { Word } from '../types/word'
import type { Rng } from './pick'

/** Задания раздела «Аорист»: образовать форму, узнать глагол, поставить в лицо, вставить в предложение. */

export type AoristTaskKind = 'form' | 'recognize' | 'person' | 'sentence-person' | 'sentence-verb'

export interface AoristTask {
  kind: AoristTaskKind
  verb: AoristVerb
  /** крупная строка задания */
  prompt: string
  /** подсказка под заданием */
  hint: string
  options: string[]
  answer: string
  /** что озвучить и показать после ответа */
  reveal: string
}

/** Глаголы как «слова» для общего прогресса (applyAnswer/pickNext/isWin). */
export const AORIST_WORDS: Word[] = AORIST_VERBS.map((v) => ({ id: v.id, el: v.present, ru: v.ru, pos: 'verb', topic: 'aorist' }))

const verbById = new Map(AORIST_VERBS.map((v) => [v.id, v]))

export function aoristVerb(id: number): AoristVerb | undefined {
  return verbById.get(id)
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

/** Ответ + до трёх уникальных отвлекающих вариантов, сначала из `preferred`. */
function withDistractors(answer: string, preferred: string[], rest: string[], rng: Rng): string[] {
  const out: string[] = [answer]
  for (const pool of [shuffle(preferred, rng), shuffle(rest, rng)]) {
    for (const o of pool) {
      if (out.length >= 4) break
      if (!out.includes(o)) out.push(o)
    }
  }
  return shuffle(out, rng)
}

function otherVerbs(verb: AoristVerb): AoristVerb[] {
  return AORIST_VERBS.filter((v) => v.id !== verb.id)
}

function sameGroupFirst(verb: AoristVerb, map: (v: AoristVerb) => string, rng: Rng): string[] {
  const others = otherVerbs(verb)
  const same = others.filter((v) => v.group === verb.group).map(map)
  const rest = others.filter((v) => v.group !== verb.group).map(map)
  return withDistractors(map(verb), same, rest, rng)
}

export function paradigm(verb: AoristVerb): string {
  return verb.forms.join(', ')
}

function personLabel(p: number): string {
  return `${PRONOUNS[p]} (${PRONOUN_RU[p]})`
}

function makeForm(verb: AoristVerb, rng: Rng): AoristTask {
  const answer = verb.forms[0]
  return {
    kind: 'form',
    verb,
    prompt: verb.present,
    hint: `${verb.ru} → аорист, εγώ («${verb.ruPast}»)`,
    options: sameGroupFirst(verb, (v) => v.forms[0], rng),
    answer,
    reveal: `${verb.present} → ${answer}`,
  }
}

function makeRecognize(verb: AoristVerb, rng: Rng): AoristTask {
  const p = Math.floor(rng() * 6)
  const shown = verb.forms[p]
  return {
    kind: 'recognize',
    verb,
    prompt: shown,
    hint: 'От какого глагола эта форма?',
    options: sameGroupFirst(verb, (v) => v.present, rng),
    answer: verb.present,
    reveal: `${shown} — ${verb.present} (${verb.ru}), ${PRONOUNS[p]}`,
  }
}

function personOptions(verb: AoristVerb, p: number, rng: Rng): string[] {
  const answer = verb.forms[p]
  return withDistractors(answer, verb.forms.filter((f) => f !== answer), [], rng)
}

function makePerson(verb: AoristVerb, rng: Rng): AoristTask {
  const p = Math.floor(rng() * 6)
  const answer = verb.forms[p]
  return {
    kind: 'person',
    verb,
    prompt: `${PRONOUNS[p]} · ${verb.present}`,
    hint: `Аорист: ${personLabel(p)}, «${verb.ru}»`,
    options: personOptions(verb, p, rng),
    answer,
    reveal: `${PRONOUNS[p]} ${answer}`,
  }
}

export function fillBlank(sentence: AoristSentence, form: string): string {
  const filled = sentence.el.replace('___', form)
  return sentence.el.startsWith('___') ? filled.charAt(0).toUpperCase() + filled.slice(1) : filled
}

function makeSentence(verb: AoristVerb, sentence: AoristSentence, byPerson: boolean, rng: Rng): AoristTask {
  const answer = verb.forms[sentence.p]
  const options = byPerson
    ? personOptions(verb, sentence.p, rng)
    : sameGroupFirst(verb, (v) => v.forms[sentence.p], rng)
  return {
    kind: byPerson ? 'sentence-person' : 'sentence-verb',
    verb,
    prompt: sentence.el,
    hint: byPerson ? `${sentence.ru}  (${verb.present})` : sentence.ru,
    options,
    answer,
    reveal: fillBlank(sentence, answer),
  }
}

export function sentencesOf(verbId: number): AoristSentence[] {
  return AORIST_SENTENCES.filter((s) => s.verb === verbId)
}

/** Тип задания выбирается случайно; предложения — примерно в половине случаев, если они есть. */
export function makeAoristTask(verb: AoristVerb, rng: Rng = Math.random): AoristTask {
  const sentences = sentencesOf(verb.id)
  const r = rng()
  if (sentences.length > 0 && r < 0.5) {
    return makeSentence(verb, pick(sentences, rng), rng() < 0.5, rng)
  }
  const k = sentences.length > 0 ? (r - 0.5) * 2 : r
  if (k < 0.35) return makeForm(verb, rng)
  if (k < 0.6) return makeRecognize(verb, rng)
  return makePerson(verb, rng)
}
