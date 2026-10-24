import { describe, expect, it } from 'vitest'
import { AORIST_SENTENCES, AORIST_VERBS } from '../data/aorist'
import { fillBlank, makeAoristTask } from './aorist'

const seq = (...vals: number[]) => {
  let i = 0
  return () => vals[i++ % vals.length]
}

describe('makeAoristTask', () => {
  it('always offers the answer among four distinct options', () => {
    for (let k = 0; k < 400; k++) {
      const verb = AORIST_VERBS[k % AORIST_VERBS.length]
      const t = makeAoristTask(verb)
      expect(t.options).toContain(t.answer)
      expect(new Set(t.options).size).toBe(t.options.length)
      expect(t.options.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('asks for the first person form from the present', () => {
    const τρώω = AORIST_VERBS.find((v) => v.present === 'τρώω')!
    const t = makeAoristTask(τρώω, seq(0.99, 0.1, 0.1, 0.1))
    expect(t.kind).toBe('person')
    const f = makeAoristTask(τρώω, seq(0.6, 0.1))
    expect(f.kind).toBe('form')
    expect(f.answer).toBe('έφαγα')
  })

  it('builds a sentence task with the right person', () => {
    const t = makeAoristTask(AORIST_VERBS[3], seq(0.1, 0, 0.1))
    expect(t.kind).toBe('sentence-person')
    const s = AORIST_SENTENCES.find((x) => x.verb === AORIST_VERBS[3].id)!
    expect(t.answer).toBe(AORIST_VERBS[3].forms[s.p])
  })

  it('capitalizes a form placed at the start of a sentence', () => {
    expect(fillBlank({ verb: 2, p: 0, el: '___ στο γυμναστήριο.', ru: '' }, 'πήγα')).toBe('Πήγα στο γυμναστήριο.')
  })
})
