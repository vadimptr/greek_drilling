import { describe, expect, it } from 'vitest'
import { AORIST_VERBS } from '../data/aorist'
import { OPTION_COUNT, aoristWords, fillBlank, makeAoristTask, meaningKeys, personsOf } from './aorist'

const seq = (...vals: number[]) => {
  let i = 0
  return () => vals[i++ % vals.length]
}

describe('makeAoristTask', () => {
  it('shows a conjugated form and offers six distinct translations with the answer', () => {
    for (const verb of AORIST_VERBS) {
      const t = makeAoristTask(verb)
      expect(t.form).toBe(verb.forms[t.person])
      expect(t.answer).toBe(verb.ru)
      expect(t.options).toHaveLength(OPTION_COUNT)
      expect(t.options).toContain(t.answer)
      expect(new Set(t.options).size).toBe(OPTION_COUNT)
    }
  })

  it('never offers a distractor that shares a meaning with another option', () => {
    for (const verb of AORIST_VERBS) {
      const keys = makeAoristTask(verb).options.flatMap(meaningKeys)
      expect(new Set(keys).size, verb.present).toBe(keys.length)
    }
  })

  it('prefers distractors from the same group', () => {
    const verb = AORIST_VERBS.find((v) => v.group === 'mai')!
    const t = makeAoristTask(verb)
    const group = new Map(AORIST_VERBS.map((v) => [v.ru, v.group]))
    expect(t.options.every((o) => group.get(o) === 'mai')).toBe(true)
  })

  it('picks the person from the rng', () => {
    const verb = AORIST_VERBS.find((v) => v.present === 'γράφω')!
    expect(makeAoristTask(verb, seq(0.2)).form).toBe('έγραψες')
    expect(makeAoristTask(verb, seq(0.99)).form).toBe('έγραψαν')
  })

  it('filters the word pool by group', () => {
    expect(aoristWords('all')).toHaveLength(AORIST_VERBS.length)
    expect(aoristWords('B2').length).toBe(AORIST_VERBS.filter((v) => v.group === 'B2').length)
  })

  it('accepts every person that shares the shown form', () => {
    const eimai = AORIST_VERBS.find((v) => v.present === 'είμαι')!
    expect(personsOf(eimai, 'ήταν')).toEqual([2, 5])
    const grafo = AORIST_VERBS.find((v) => v.present === 'γράφω')!
    expect(personsOf(grafo, 'γράψαμε')).toEqual([3])
  })

  it('capitalizes a form placed at the start of a sentence', () => {
    expect(fillBlank({ verb: 2, p: 0, el: '___ στο γυμναστήριο.', ru: '' }, 'πήγα')).toBe('Πήγα στο γυμναστήριο.')
  })
})
