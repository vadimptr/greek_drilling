import { describe, expect, it } from 'vitest'
import type { MockVariant } from '../types/mock'
import {
  countCorrect,
  emptyLanguageAnswers,
  emptyReadingAnswers,
  gradeLanguage,
  gradeReading,
  initialMockState,
  isPassed,
  recordAttempt,
} from './mock'

const variant: MockVariant = {
  id: 1,
  title: 'v1',
  reading: [
    {
      type: 'tf',
      title: 't1',
      intro: '',
      text: '',
      items: [
        { statement: 'a', answer: true },
        { statement: 'b', answer: false },
      ],
    },
    { type: 'match', title: 't2', intro: '', text: '', lefts: ['l1', 'l2'], rights: ['r0', 'r1', 'r2', 'r3'], answer: [2, 0] },
    {
      type: 'mc',
      title: 't3',
      intro: '',
      text: '',
      items: [
        { question: 'q', options: ['a', 'b', 'c'], answer: 1 },
        { question: 'q', options: ['a', 'b', 'c'], answer: 2 },
      ],
    },
    { type: 'gap', title: 't4', intro: '', text: 'x {{1}} y {{2}}', bank: ['w0', 'w1', 'w2', 'w3'], answer: [3, 1] },
  ],
  language: [
    { prompt: 'p', options: ['a', 'b', 'c'], answer: 0, kind: 'grammar' },
    { prompt: 'p', options: ['a', 'b', 'c'], answer: 2, kind: 'vocab' },
  ],
}

describe('mock grading', () => {
  it('emptyReadingAnswers has the right shape', () => {
    expect(emptyReadingAnswers(variant)).toEqual([
      [null, null],
      [null, null],
      [null, null],
      [null, null],
    ])
    expect(emptyLanguageAnswers(variant)).toEqual([null, null])
  })

  it('countCorrect per task type, null never counts', () => {
    expect(countCorrect(variant.reading[0], [1, 0])).toBe(2)
    expect(countCorrect(variant.reading[0], [1, null])).toBe(1)
    expect(countCorrect(variant.reading[1], [2, 1])).toBe(1)
    expect(countCorrect(variant.reading[2], [1, 2])).toBe(2)
    expect(countCorrect(variant.reading[3], [3, 0])).toBe(1)
  })

  it('gradeReading scales correct items to official task points', () => {
    const r = gradeReading(variant, [
      [1, 0],
      [2, 0],
      [1, 0],
      [3, 1],
    ])
    expect(r.correctPerTask).toEqual([2, 2, 1, 2])
    expect(r.perTask).toEqual([7, 6, 3, 6])
    expect(r.total).toBe(22)
    expect(r.max).toBe(25)
  })

  it('gradeLanguage counts correct answers', () => {
    expect(gradeLanguage(variant, [0, 2])).toEqual({ total: 2, max: 2 })
    expect(gradeLanguage(variant, [1, null])).toEqual({ total: 0, max: 2 })
  })

  it('isPassed uses 60% threshold inclusive', () => {
    expect(isPassed(15, 25)).toBe(true)
    expect(isPassed(14.5, 25)).toBe(false)
    expect(isPassed(0, 0)).toBe(false)
  })

  it('recordAttempt prepends, caps history and cycles variant', () => {
    let s = { ...initialMockState(), nextVariant: 2 }
    const attempt = { date: '2026-09-09', variantId: 3, reading: 20, language: 18, passed: true }
    s = recordAttempt(s, attempt, 3)
    expect(s.history[0]).toEqual(attempt)
    expect(s.nextVariant).toBe(0)
    for (let i = 0; i < 25; i++) s = recordAttempt(s, attempt, 3)
    expect(s.history).toHaveLength(20)
  })
})
