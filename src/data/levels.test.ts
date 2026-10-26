import { describe, expect, it } from 'vitest'
import { ALL_WORDS, wordPool } from './levels'
import { WORDS } from './words'
import { WORDS_A2 } from './words-a2'
import { WORDS_B1 } from './words-b1'

describe('word levels', () => {
  it('pools are cumulative and sized by level', () => {
    expect(wordPool('A1')).toBe(WORDS)
    expect(wordPool('A2').length).toBeGreaterThanOrEqual(1500)
    expect(wordPool('A2').length).toBeLessThanOrEqual(2000)
    expect(wordPool('B1').length).toBeGreaterThanOrEqual(2500)
    expect(wordPool('B1').length).toBeLessThanOrEqual(3000)
  })

  it('A2 ids start at 1001 and B1 ids at 2001, consecutive', () => {
    WORDS_A2.forEach((w, i) => expect(w.id).toBe(1001 + i))
    WORDS_B1.forEach((w, i) => expect(w.id).toBe(2001 + i))
  })

  it('has unique ids, greek words and translations across all levels', () => {
    for (const field of ['id', 'el', 'ru'] as const) {
      const seen = new Map<string, number>()
      for (const w of ALL_WORDS) {
        const key = String(w[field]).trim().toLowerCase()
        expect(seen.has(key), `duplicate ${field} "${key}" (ids ${seen.get(key)} and ${w.id})`).toBe(false)
        seen.set(key, w.id)
      }
    }
  })

  it('new words have greek letters and nouns carry an article', () => {
    for (const w of [...WORDS_A2, ...WORDS_B1]) {
      expect(/[Ͱ-Ͽ]/.test(w.el), `no greek letters in "${w.el}"`).toBe(true)
      expect(w.ru.trim().length).toBeGreaterThan(0)
      if (w.pos === 'noun') expect(/^(ο|η|το|οι|τα) /.test(w.el), `noun without article: "${w.el}"`).toBe(true)
    }
  })
})
