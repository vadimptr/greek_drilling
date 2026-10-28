import { describe, expect, it } from 'vitest'
import { parseRoute, pathFor } from './route'

describe('route', () => {
  it('maps tabs to paths and back', () => {
    expect(pathFor('city', 'lessons')).toBe('/mythopoli')
    expect(pathFor('grammar', 'nouns')).toBe('/grammar/nouns')
    expect(pathFor('grammar', 'lessons')).toBe('/grammar')
    expect(parseRoute('/mythopoli', '')).toEqual({ tab: 'city' })
    expect(parseRoute('/speak/', '')).toEqual({ tab: 'speak' })
    expect(parseRoute('/grammar/aorist', '')).toEqual({ tab: 'grammar', sub: 'aorist' })
    expect(parseRoute('/grammar', '')).toEqual({ tab: 'grammar', sub: 'lessons' })
  })

  it('keeps old ?tab= links and ignores unknown paths', () => {
    expect(parseRoute('/', '?tab=mock')).toEqual({ tab: 'mock' })
    expect(parseRoute('/', '')).toBeNull()
    expect(parseRoute('/nope', '')).toBeNull()
  })
})
