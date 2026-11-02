import { describe, expect, it } from 'vitest'
import { groupOf, mobileTabs, navGroups, navOf, routeOf } from './nav'

describe('nav', () => {
  it('maps grammar subsections and plain tabs both ways', () => {
    expect(navOf('grammar', 'aorist')).toBe('aorist')
    expect(navOf('spell', 'lessons')).toBe('spell')
    expect(routeOf('nouns')).toEqual({ tab: 'grammar', sub: 'nouns' })
    expect(routeOf('speak')).toEqual({ tab: 'speak' })
  })

  it('groups vocabulary, grammar and practice; other languages get only the town', () => {
    expect(groupOf('spell')).toBe('vocab')
    expect(groupOf('aorist')).toBe('grammar')
    expect(navGroups('el').map((g) => g.id)).toEqual(['vocab', 'grammar', 'practice'])
    expect(navGroups('en')).toEqual([{ id: 'practice', items: ['city'] }])
    expect(mobileTabs('el')).toEqual(['vocab', 'grammar', 'mock', 'city'])
    expect(mobileTabs('ru')).toEqual(['city'])
  })
})
