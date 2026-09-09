import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import { APP_STORAGE_KEY, deserializeApp, initialAppState, loadApp, saveApp, serializeApp } from './appState'
import { initialState as initialWords } from './state'
import { STORAGE_KEY as V1_KEY } from './storage'

const w = (id: number): Word => ({ id, el: `el${id}`, ru: `ru${id}`, pos: 'noun', topic: 't' })
const words = [w(1), w(2), w(3)]
const lessonIds = [1, 2, 3]

describe('deserializeApp', () => {
  it('round-trips a full state', () => {
    const s = {
      ...initialAppState(),
      tab: 'grammar' as const,
      words: { ...initialWords('ru-el', false), learned: [2], score: 1, bestStreak: 1, lastId: 2 },
      grammar: { completed: [1, 2], score: 3, bestStreak: 5, active: { lessonId: 3, queue: ['3-2', '3-1'] } },
      mock: { history: [{ date: '2026-09-09', variantId: 1, reading: 20, language: 15, passed: true }], nextVariant: 1 },
    }
    expect(deserializeApp(serializeApp(s), null, words, lessonIds)).toEqual(s)
  })

  it('migrates words from v1 when v2 is absent', () => {
    const v1 = JSON.stringify({ ...initialWords(), learned: [1, 3], score: 2, bestStreak: 4, lastId: 3 })
    const s = deserializeApp(null, v1, words, lessonIds)
    expect(s.words.learned).toEqual([1, 3])
    expect(s.words.bestStreak).toBe(4)
    expect(s.grammar).toEqual(initialAppState().grammar)
    expect(s.tab).toBe('words')
  })

  it('returns initial state for garbage v2 and ignores v1 then', () => {
    const v1 = JSON.stringify({ ...initialWords(), learned: [1] })
    expect(deserializeApp('nope', v1, words, lessonIds)).toEqual(initialAppState())
    expect(deserializeApp('[]', null, words, lessonIds)).toEqual(initialAppState())
  })

  it('drops unknown lesson ids and invalid active', () => {
    const raw = JSON.stringify({
      ...initialAppState(),
      grammar: { completed: [1, 99, 'x'], score: -1, bestStreak: 2, active: { lessonId: 42, queue: ['a'] } },
      mock: { history: [{ bad: true }, { date: 'd', variantId: 0, reading: 1, language: 2, passed: false }], nextVariant: 'z' },
      tab: 'weird',
    })
    const s = deserializeApp(raw, null, words, lessonIds)
    expect(s.grammar).toEqual({ completed: [1], score: 0, bestStreak: 2, active: null })
    expect(s.mock.history).toHaveLength(1)
    expect(s.mock.nextVariant).toBe(0)
    expect(s.tab).toBe('words')
  })

  it('active with empty queue becomes null', () => {
    const raw = JSON.stringify({ ...initialAppState(), grammar: { ...initialAppState().grammar, active: { lessonId: 1, queue: [] } } })
    expect(deserializeApp(raw, null, words, lessonIds).grammar.active).toBeNull()
  })
})

describe('loadApp/saveApp', () => {
  it('saves under v2 key and prefers v2 over v1', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    storage.setItem(V1_KEY, JSON.stringify({ ...initialWords(), learned: [1] }))
    const s = { ...initialAppState(), tab: 'mock' as const }
    saveApp(storage, s)
    expect(store.has(APP_STORAGE_KEY)).toBe(true)
    const loaded = loadApp(storage, words, lessonIds)
    expect(loaded.tab).toBe('mock')
    expect(loaded.words.learned).toEqual([])
  })
})
