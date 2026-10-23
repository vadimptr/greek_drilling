import { describe, expect, it } from 'vitest'
import { nameError } from './name'

describe('nameError', () => {
  it('accepts letters of any alphabet, digits, _ and -', () => {
    for (const n of ['vadim', 'Вадим_1', 'Αννα-2', 'abc', 'x'.repeat(32), '  trimmed  ']) expect(nameError(n)).toBeNull()
  })

  it('rejects short, long, spaced and symbol names', () => {
    expect(nameError('ab')).toMatch(/минимум/)
    expect(nameError('x'.repeat(33))).toMatch(/максимум/)
    expect(nameError('va dim')).toMatch(/пробел/)
    expect(nameError('va@dim')).toMatch(/буквы/)
  })
})
