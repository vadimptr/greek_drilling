import { describe, expect, it } from 'vitest'
import { AORIST_SENTENCES, AORIST_VERBS } from '.'

const accents = (s: string) => (s.normalize('NFD').match(/́/g) ?? []).length

describe('aorist data', () => {
  it('has unique ids and six forms with one stress each', () => {
    expect(new Set(AORIST_VERBS.map((v) => v.id)).size).toBe(AORIST_VERBS.length)
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

  it('has sentences with one gap pointing to a known verb and person', () => {
    const ids = new Set(AORIST_VERBS.map((v) => v.id))
    for (const s of AORIST_SENTENCES) {
      expect(ids.has(s.verb), s.el).toBe(true)
      expect(s.el.split('___')).toHaveLength(2)
      expect(s.p).toBeGreaterThanOrEqual(0)
      expect(s.p).toBeLessThan(6)
    }
  })

  it('gives every verb at least one sentence', () => {
    for (const v of AORIST_VERBS) expect(AORIST_SENTENCES.some((s) => s.verb === v.id), v.present).toBe(true)
  })
})
