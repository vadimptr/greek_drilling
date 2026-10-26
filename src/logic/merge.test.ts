import { describe, expect, it } from 'vitest'
import { initialAppState, type AppState } from './appState'
import { hasProgress, mergeApp } from './merge'
import { initialState as initialWords } from './state'

const base = (): AppState => initialAppState()

describe('mergeApp', () => {
  it('takes local as is when the account has no saved state', () => {
    const local = { ...base(), words: { ...initialWords(), learned: [1] } }
    expect(mergeApp(local, null)).toBe(local)
  })

  it('unions learned, keeps max counters and drops weak words learned anywhere', () => {
    const local: AppState = {
      ...base(),
      words: { ...initialWords('el-ru', true), learned: [1, 2], weak: { 3: 1, 4: 2 }, score: 5, bestStreak: 3, lastId: 2 },
    }
    const remote: AppState = {
      ...base(),
      tab: 'grammar',
      words: { ...initialWords('ru-el', false), learned: [2, 3], weak: { 4: 3, 5: 1 }, score: 1, bestStreak: 9, lastId: 7 },
    }
    const m = mergeApp(local, remote)
    expect(m.tab).toBe('grammar')
    expect(m.words).toEqual({
      learned: [2, 3, 1],
      weak: { 4: 3, 5: 1 },
      score: 5,
      bestStreak: 9,
      lastId: 7,
      direction: 'ru-el',
      autoSpeak: false,
      level: 'A1',
    })
  })

  it('merges grammar and mock history without duplicates', () => {
    const a1 = { date: '2026-09-01', variantId: 1, reading: 10, language: 10, passed: false }
    const a2 = { date: '2026-09-05', variantId: 2, reading: 20, language: 20, passed: true }
    const a3 = { date: '2026-09-03', variantId: 1, reading: 15, language: 15, passed: true }
    const local: AppState = {
      ...base(),
      grammar: { completed: [1, 2], score: 4, bestStreak: 2, active: { lessonId: 3, queue: ['a'] } },
      mock: { history: [a1, a3], nextVariant: 2 },
    }
    const remote: AppState = {
      ...base(),
      grammar: { completed: [2, 5], score: 1, bestStreak: 7, active: null },
      mock: { history: [a1, a2], nextVariant: 1 },
    }
    const m = mergeApp(local, remote)
    expect(m.grammar).toEqual({ completed: [2, 5, 1], score: 4, bestStreak: 7, active: { lessonId: 3, queue: ['a'] } })
    expect(m.mock).toEqual({ history: [a1, a3, a2], nextVariant: 2 })
  })
})

describe('hasProgress', () => {
  it('is false for a fresh state with changed settings and true after any progress', () => {
    expect(hasProgress({ ...base(), tab: 'mock', speakHint: 'ru' })).toBe(false)
    expect(hasProgress({ ...base(), spell: { ...base().spell, weak: { 1: 3 } } })).toBe(true)
    expect(hasProgress({ ...base(), mock: { history: [{ date: 'd', variantId: 0, reading: 0, language: 0, passed: false }], nextVariant: 1 } })).toBe(true)
  })
})
