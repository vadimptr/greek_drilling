import { describe, expect, it } from 'vitest'
import { WORDS } from '../words'
import { NOUNS } from './index'

const byEl = new Map(WORDS.map((w) => [w.el, w]))

describe('NOUNS data', () => {
  it('has a solid set of nouns, each present in the dictionary as a noun', () => {
    expect(NOUNS.length).toBeGreaterThanOrEqual(150)
    for (const entry of NOUNS) {
      const w = byEl.get(entry.el)
      expect(w, entry.el).toBeDefined()
      expect(w!.pos, entry.el).toBe('noun')
    }
  })

  it('has unique entries', () => {
    expect(new Set(NOUNS.map((e) => e.el)).size).toBe(NOUNS.length)
  })

  it('has 6 greek forms, nominative singular equal to the dictionary form without article', () => {
    for (const entry of NOUNS) {
      expect(entry.forms, entry.el).toHaveLength(6)
      for (const f of entry.forms) expect(f, entry.el).toMatch(/^[\p{Script=Greek}]+$/u)
      const [article, ...rest] = entry.el.split(' ')
      expect(['ο', 'η', 'το'], entry.el).toContain(article)
      expect(entry.forms[0], entry.el).toBe(rest.join(' '))
    }
  })

  it('has at least 4 distinct forms so that transform tasks get 4 options', () => {
    for (const entry of NOUNS) expect(new Set(entry.forms).size, entry.el).toBeGreaterThanOrEqual(4)
  })

  it('follows basic paradigm sanity: plural forms differ from singular nominative', () => {
    for (const entry of NOUNS) {
      expect(entry.forms[3], entry.el).not.toBe(entry.forms[0])
      expect(entry.forms[4], entry.el).toMatch(/[ωώ]ν$/u)
    }
  })
})
