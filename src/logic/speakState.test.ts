import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import { pickNext } from './pick'
import { applyAnswer, isWin } from './state'
import { initialSpeakState, restartSpeak, skipWord, type SpeakState } from './speakState'

const words: Word[] = [
  { id: 1, el: 'α', ru: 'а', pos: 'other', topic: 't' },
  { id: 2, el: 'β', ru: 'б', pos: 'other', topic: 't' },
]

describe('speak state', () => {
  it('starts empty', () => {
    expect(initialSpeakState()).toEqual({ learned: [], weak: {}, score: 0, bestStreak: 0, lastId: null })
  })

  it('skip counts down the wait of other words', () => {
    const s: SpeakState = { learned: [2], weak: { 1: 2 }, score: 4, bestStreak: 7, lastId: 2 }
    expect(skipWord(s, 1)).toEqual({ ...s, lastId: 1 })
    expect(skipWord(s, 3)).toEqual({ ...s, weak: { 1: 1 }, lastId: 3 })
  })

  it('shares answer/win/pick logic with the words section', () => {
    let s = initialSpeakState()
    s = applyAnswer(s, 1, true)
    expect(s.score).toBe(1)
    expect(s.learned).toEqual([1])
    s = applyAnswer(s, 2, false, () => 0)
    expect(s.score).toBe(0)
    expect(s.weak).toEqual({ 2: 3 })
    expect(isWin(s, words)).toBe(false)
    expect(pickNext(s, words, () => 0)?.id).toBe(2)
    s = applyAnswer(s, 2, true)
    expect(isWin(s, words)).toBe(true)
    expect(s.bestStreak).toBe(1)
  })

  it('restart resets everything', () => {
    const s: SpeakState = { learned: [2], weak: { 1: 2 }, score: 4, bestStreak: 7, lastId: 2 }
    expect(restartSpeak(s)).toEqual(initialSpeakState())
  })
})
