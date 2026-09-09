import { describe, expect, it } from 'vitest'
import { VARIANTS } from './index'

const unique = (xs: unknown[]) => new Set(xs.map((x) => String(x).trim().toLowerCase())).size === xs.length

describe('VARIANTS', () => {
  it('has at least 3 variants with unique ids', () => {
    expect(VARIANTS.length).toBeGreaterThanOrEqual(3)
    expect(new Set(VARIANTS.map((v) => v.id)).size).toBe(VARIANTS.length)
  })

  it('reading part follows the official A1 structure', () => {
    for (const v of VARIANTS) {
      expect(v.reading.map((t) => t.type), `variant ${v.id}`).toEqual(['tf', 'match', 'mc', 'gap'])
      const [tf, match, mc, gap] = v.reading
      if (tf.type !== 'tf' || match.type !== 'match' || mc.type !== 'mc' || gap.type !== 'gap') throw new Error('types')

      expect(tf.items, `v${v.id} tf`).toHaveLength(7)
      expect(tf.text.split(/\s+/).length, `v${v.id} tf text length`).toBeGreaterThanOrEqual(60)

      expect(match.lefts, `v${v.id} match lefts`).toHaveLength(6)
      expect(match.rights, `v${v.id} match rights`).toHaveLength(8)
      expect(match.answer, `v${v.id} match answer`).toHaveLength(6)
      expect(unique(match.answer), `v${v.id} match duplicate answers`).toBe(true)
      for (const a of match.answer) expect(a).toBeGreaterThanOrEqual(0), expect(a).toBeLessThan(8)
      expect(unique(match.rights), `v${v.id} match duplicate rights`).toBe(true)

      expect(mc.items, `v${v.id} mc`).toHaveLength(4)
      for (const item of mc.items) {
        expect(item.options, `v${v.id} mc options`).toHaveLength(3)
        expect(unique(item.options), `v${v.id} mc duplicate options`).toBe(true)
        expect(item.answer).toBeGreaterThanOrEqual(0)
        expect(item.answer).toBeLessThan(3)
      }

      expect(gap.answer, `v${v.id} gap`).toHaveLength(4)
      expect(gap.bank, `v${v.id} gap bank`).toHaveLength(6)
      expect(unique(gap.bank), `v${v.id} gap duplicate bank`).toBe(true)
      expect(unique(gap.answer), `v${v.id} gap duplicate answers`).toBe(true)
      for (let i = 1; i <= 4; i++) {
        expect((gap.text.match(new RegExp(`\\{\\{${i}\\}\\}`, 'g')) ?? []).length, `v${v.id} gap {{${i}}}`).toBe(1)
      }
      expect(gap.text.includes('{{5}}'), `v${v.id} extra gap`).toBe(false)
      for (const a of gap.answer) expect(a).toBeGreaterThanOrEqual(0), expect(a).toBeLessThan(6)
    }
  })

  it('language part has 25 items with 3 unique options and both kinds', () => {
    for (const v of VARIANTS) {
      expect(v.language, `variant ${v.id}`).toHaveLength(25)
      const kinds = new Set(v.language.map((i) => i.kind))
      expect(kinds.has('grammar') && kinds.has('vocab'), `v${v.id} kinds`).toBe(true)
      v.language.forEach((item, i) => {
        expect(item.options, `v${v.id} lang ${i}`).toHaveLength(3)
        expect(unique(item.options), `v${v.id} lang ${i} duplicates`).toBe(true)
        expect(item.answer).toBeGreaterThanOrEqual(0)
        expect(item.answer).toBeLessThan(3)
        expect(item.prompt.trim().length).toBeGreaterThan(0)
      })
    }
  })
})
