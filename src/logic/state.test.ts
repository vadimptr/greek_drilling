import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import { WEAK_REPEATS, applyAnswer, initialState, isWin, restart } from './state'

const words: Word[] = [
  { id: 1, el: 'το σπίτι', ru: 'дом', pos: 'noun', topic: 'home' },
  { id: 2, el: 'το νερό', ru: 'вода', pos: 'noun', topic: 'food' },
]

describe('applyAnswer', () => {
  it('correct on fresh word: +1 score, learned, bestStreak', () => {
    const s = applyAnswer(initialState(), 1, true)
    expect(s.score).toBe(1)
    expect(s.bestStreak).toBe(1)
    expect(s.learned).toEqual([1])
    expect(s.weak).toEqual({})
    expect(s.lastId).toBe(1)
  })

  it('wrong: score reset, word goes to weak with 3, removed from learned', () => {
    let s = applyAnswer(initialState(), 1, true)
    s = applyAnswer(s, 2, true)
    s = applyAnswer(s, 1, false)
    expect(s.score).toBe(0)
    expect(s.bestStreak).toBe(2)
    expect(s.weak).toEqual({ 1: WEAK_REPEATS })
    expect(s.learned).toEqual([2])
  })

  it('weak word needs 3 correct answers, then becomes learned', () => {
    let s = applyAnswer(initialState(), 1, false)
    s = applyAnswer(s, 1, true)
    expect(s.weak).toEqual({ 1: 2 })
    s = applyAnswer(s, 1, true)
    expect(s.weak).toEqual({ 1: 1 })
    expect(s.learned).toEqual([])
    s = applyAnswer(s, 1, true)
    expect(s.weak).toEqual({})
    expect(s.learned).toEqual([1])
    expect(s.score).toBe(3)
  })

  it('second mistake resets weak counter to 3', () => {
    let s = applyAnswer(initialState(), 1, false)
    s = applyAnswer(s, 1, true)
    s = applyAnswer(s, 1, false)
    expect(s.weak).toEqual({ 1: WEAK_REPEATS })
  })

  it('does not duplicate learned ids', () => {
    let s = applyAnswer(initialState(), 1, true)
    s = applyAnswer(s, 1, true)
    expect(s.learned).toEqual([1])
  })
})

describe('isWin / restart', () => {
  it('win only when all words learned and weak is empty', () => {
    let s = applyAnswer(initialState(), 1, true)
    expect(isWin(s, words)).toBe(false)
    s = applyAnswer(s, 2, false)
    expect(isWin(s, words)).toBe(false)
    s = applyAnswer(s, 2, true)
    s = applyAnswer(s, 2, true)
    s = applyAnswer(s, 2, true)
    expect(isWin(s, words)).toBe(true)
  })

  it('restart keeps direction and clears everything else', () => {
    let s = initialState('ru-el')
    s = applyAnswer(s, 1, true)
    const r = restart(s)
    expect(r).toEqual(initialState('ru-el'))
  })
})
