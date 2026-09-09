import { describe, expect, it } from 'vitest'
import { WORDS } from './words'

describe('WORDS', () => {
  it('has between 600 and 800 entries', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(600)
    expect(WORDS.length).toBeLessThanOrEqual(800)
  })

  it('has unique ids equal to index + 1', () => {
    WORDS.forEach((w, i) => expect(w.id).toBe(i + 1))
  })

  it('has unique greek words (case-insensitive, trimmed)', () => {
    const seen = new Map<string, number>()
    for (const w of WORDS) {
      const key = w.el.trim().toLowerCase()
      expect(seen.has(key), `duplicate el "${w.el}" (ids ${seen.get(key)} and ${w.id})`).toBe(false)
      seen.set(key, w.id)
    }
  })

  it('has unique russian translations (case-insensitive, trimmed)', () => {
    const seen = new Map<string, number>()
    for (const w of WORDS) {
      const key = w.ru.trim().toLowerCase()
      expect(seen.has(key), `duplicate ru "${w.ru}" (ids ${seen.get(key)} and ${w.id})`).toBe(false)
      seen.set(key, w.id)
    }
  })

  it('has non-empty fields and greek letters in el', () => {
    for (const w of WORDS) {
      expect(w.el.trim().length, `empty el for id ${w.id}`).toBeGreaterThan(0)
      expect(w.ru.trim().length, `empty ru for id ${w.id}`).toBeGreaterThan(0)
      expect(w.topic.trim().length, `empty topic for id ${w.id}`).toBeGreaterThan(0)
      expect(/[Ͱ-Ͽἀ-῿]/.test(w.el), `no greek letters in "${w.el}"`).toBe(true)
    }
  })

  it('nouns carry an article', () => {
    for (const w of WORDS) {
      if (w.pos !== 'noun') continue
      expect(/^(ο|η|το|οι|τα) /.test(w.el), `noun without article: "${w.el}" (id ${w.id})`).toBe(true)
    }
  })
})
