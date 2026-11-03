import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import { WEAK_GAP_MAX, WEAK_GAP_MIN, applyAnswer, initialState, isWin, restart, weakGap } from './state'

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

  it('wrong: score reset, word waits 3–5 words, removed from learned', () => {
    let s = applyAnswer(initialState(), 1, true)
    s = applyAnswer(s, 2, true)
    s = applyAnswer(s, 1, false, () => 0)
    expect(s.score).toBe(0)
    expect(s.bestStreak).toBe(2)
    expect(s.weak).toEqual({ 1: WEAK_GAP_MIN })
    expect(s.learned).toEqual([2])
  })

  it('gap is between 3 and 5 words', () => {
    expect(weakGap(() => 0)).toBe(WEAK_GAP_MIN)
    expect(weakGap(() => 0.999)).toBe(WEAK_GAP_MAX)
  })

  it('other answers count down the wait', () => {
    let s = applyAnswer(initialState(), 1, false, () => 0)
    s = applyAnswer(s, 2, true)
    expect(s.weak).toEqual({ 1: 2 })
    s = applyAnswer(s, 3, false, () => 0)
    expect(s.weak).toEqual({ 1: 1, 3: 3 })
    s = applyAnswer(applyAnswer(s, 4, true), 5, true)
    expect(s.weak).toEqual({ 1: 0, 3: 1 })
  })

  it('one correct answer returns a weak word to learned', () => {
    let s = applyAnswer(initialState(), 1, false)
    s = applyAnswer(s, 1, true)
    expect(s.weak).toEqual({})
    expect(s.learned).toEqual([1])
    expect(s.score).toBe(1)
  })

  it('second mistake starts the wait again', () => {
    let s = applyAnswer(initialState(), 1, false, () => 0)
    s = applyAnswer(applyAnswer(applyAnswer(s, 2, true), 3, true), 4, true)
    s = applyAnswer(s, 1, false, () => 0.999)
    expect(s.weak).toEqual({ 1: WEAK_GAP_MAX })
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

  it('restart keeps direction, autoSpeak and level, clears everything else', () => {
    let s = initialState('ru-el', false, 'B1')
    s = applyAnswer(s, 1, true)
    const r = restart(s)
    expect(r).toEqual(initialState('ru-el', false, 'B1'))
  })

  it('weak words outside the pool do not block the win', () => {
    let s = applyAnswer(initialState(), 1, true)
    s = applyAnswer(s, 2, true)
    s = applyAnswer(s, 3, true)
    s = applyAnswer(s, 99, false)
    expect(isWin(s, words)).toBe(true)
  })
})
