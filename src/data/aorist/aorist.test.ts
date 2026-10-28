import { describe, expect, it } from 'vitest'
import { AORIST_GROUPS, AORIST_SENTENCES, AORIST_VERBS, conjugate } from '.'

const accents = (s: string) => (s.normalize('NFD').match(/́/g) ?? []).length
const byPresent = (p: string) => AORIST_VERBS.find((v) => v.present === p)!

describe('aorist data', () => {
  it('has unique ids, presents and translations', () => {
    expect(new Set(AORIST_VERBS.map((v) => v.id)).size).toBe(AORIST_VERBS.length)
    expect(new Set(AORIST_VERBS.map((v) => v.present)).size).toBe(AORIST_VERBS.length)
    expect(new Set(AORIST_VERBS.map((v) => v.ru)).size).toBe(AORIST_VERBS.length)
  })

  it('keeps the ids of the original 38 verbs so saved progress survives', () => {
    const ids = new Set(AORIST_VERBS.map((v) => v.id))
    for (let id = 1; id <= 38; id++) expect(ids.has(id), String(id)).toBe(true)
  })

  it('covers every group with a sizeable list', () => {
    for (const g of AORIST_GROUPS) expect(AORIST_VERBS.filter((v) => v.group === g.id).length, g.id).toBeGreaterThanOrEqual(40)
  })

  it('has six forms with one stress each', () => {
    for (const v of AORIST_VERBS) {
      expect(v.forms).toHaveLength(6)
      for (const f of v.forms) expect(accents(f), `${v.present}: ${f}`).toBe(1)
    }
  })

  it('never shares a form between two verbs', () => {
    const owner = new Map<string, number>()
    for (const v of AORIST_VERBS)
      for (const f of v.forms) {
        expect(owner.get(f) ?? v.id, f).toBe(v.id)
        owner.set(f, v.id)
      }
  })

  it('moves the stress and drops the augment in the plural', () => {
    expect(conjugate('γράφω', 'έγραψα')).toEqual(['έγραψα', 'έγραψες', 'έγραψε', 'γράψαμε', 'γράψατε', 'έγραψαν'])
    expect(byPresent('βλέπω').forms[3]).toBe('είδαμε')
    expect(byPresent('λέω').forms[4]).toBe('είπατε')
    expect(byPresent('ελέγχω').forms[3]).toBe('ελέγξαμε')
    expect(byPresent('κλείνω').forms[3]).toBe('κλείσαμε')
    expect(byPresent('ακούω').forms[3]).toBe('ακούσαμε')
    expect(byPresent('νιώθω').forms[3]).toBe('νιώσαμε')
    expect(byPresent('κοιμάμαι').forms).toEqual(['κοιμήθηκα', 'κοιμήθηκες', 'κοιμήθηκε', 'κοιμηθήκαμε', 'κοιμηθήκατε', 'κοιμήθηκαν'])
    expect(byPresent('πίνω').forms[3]).toBe('ήπιαμε')
    expect(byPresent('θέλω').forms[4]).toBe('θέλατε')
    expect(byPresent('είμαι').forms).toEqual(['ήμουν', 'ήσουν', 'ήταν', 'ήμασταν', 'ήσασταν', 'ήταν'])
  })

  it('has sentences with one gap pointing to a known verb and person', () => {
    const ids = new Set(AORIST_VERBS.map((v) => v.id))
    for (const s of AORIST_SENTENCES) {
      expect(ids.has(s.verb), s.el).toBe(true)
      expect(s.el.split('___')).toHaveLength(2)
      expect(s.p).toBeGreaterThanOrEqual(0)
      expect(s.p).toBeLessThan(6)
    }
  })
})
