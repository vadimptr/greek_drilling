import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import { initialState } from './state'
import { WEAK_PROBABILITY, pickNext } from './pick'

const w = (id: number): Word => ({ id, el: `el${id}`, ru: `ru${id}`, pos: 'noun', topic: 't' })
const words = [w(1), w(2), w(3), w(4)]

/** rng, выдающий значения по очереди */
const seq = (...values: number[]) => {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('pickNext', () => {
  it('picks from fresh words when there are no weak words', () => {
    const s = { ...initialState(), learned: [1, 2] }
    expect(pickNext(s, words, seq(0))?.id).toBe(3)
    expect(pickNext(s, words, seq(0.99))?.id).toBe(4)
  })

  it('picks weak when rng below WEAK_PROBABILITY', () => {
    const s = { ...initialState(), weak: { 4: 3 } }
    expect(pickNext(s, words, seq(WEAK_PROBABILITY - 0.01, 0))?.id).toBe(4)
  })

  it('picks fresh when rng at or above WEAK_PROBABILITY', () => {
    const s = { ...initialState(), weak: { 4: 3 } }
    expect(pickNext(s, words, seq(WEAK_PROBABILITY, 0))?.id).toBe(1)
  })

  it('always picks weak when no fresh words remain', () => {
    const s = { ...initialState(), learned: [1, 2, 3], weak: { 4: 1 } }
    expect(pickNext(s, words, seq(0.99, 0))?.id).toBe(4)
  })

  it('avoids repeating lastId when pool has alternatives', () => {
    const s = { ...initialState(), learned: [1, 2], lastId: 3 }
    expect(pickNext(s, words, seq(0))?.id).toBe(4)
    expect(pickNext(s, words, seq(0.99))?.id).toBe(4)
  })

  it('switches pool when chosen pool contains only lastId', () => {
    const weakOnlyLast = { ...initialState(), weak: { 4: 2 }, lastId: 4 }
    expect(pickNext(weakOnlyLast, words, seq(0, 0))?.id).toBe(1)
    const freshOnlyLast = { ...initialState(), learned: [1, 2], weak: { 4: 2 }, lastId: 3 }
    expect(pickNext(freshOnlyLast, words, seq(0.99, 0))?.id).toBe(4)
  })

  it('repeats lastId when it is the only word left', () => {
    const s = { ...initialState(), learned: [1, 2, 3], weak: { 4: 1 }, lastId: 4 }
    expect(pickNext(s, words, seq(0))?.id).toBe(4)
  })

  it('returns null when everything is learned', () => {
    const s = { ...initialState(), learned: [1, 2, 3, 4] }
    expect(pickNext(s, words, seq(0))).toBeNull()
  })
})
