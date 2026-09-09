import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import { initialState } from './state'
import { STORAGE_KEY, deserialize, loadState, saveState, serialize } from './storage'

const w = (id: number): Word => ({ id, el: `el${id}`, ru: `ru${id}`, pos: 'noun', topic: 't' })
const words = [w(1), w(2), w(3)]

class MemoryStorage {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
}

describe('serialize/deserialize', () => {
  it('round-trips a state', () => {
    const s = { ...initialState('ru-el'), learned: [1], weak: { 2: 2 }, score: 3, bestStreak: 5, lastId: 2 }
    expect(deserialize(serialize(s), words)).toEqual(s)
  })

  it('returns initial state for null, garbage and wrong shapes', () => {
    expect(deserialize(null, words)).toEqual(initialState())
    expect(deserialize('not json', words)).toEqual(initialState())
    expect(deserialize('[]', words)).toEqual(initialState())
    expect(deserialize('{"learned":"x"}', words)).toEqual(initialState())
  })

  it('drops ids that are not in the dictionary and invalid weak counters', () => {
    const raw = JSON.stringify({
      learned: [1, 99, 'a'],
      weak: { 2: 1, 77: 3, 3: 0 },
      score: 2,
      bestStreak: 4,
      lastId: 99,
      direction: 'el-ru',
    })
    expect(deserialize(raw, words)).toEqual({
      ...initialState(),
      learned: [1],
      weak: { 2: 1 },
      score: 2,
      bestStreak: 4,
      lastId: null,
    })
  })

  it('falls back to el-ru for unknown direction', () => {
    const raw = JSON.stringify({ ...initialState(), direction: 'xx' })
    expect(deserialize(raw, words).direction).toBe('el-ru')
  })

  it('autoSpeak defaults to true when missing and is kept when false', () => {
    const { autoSpeak: _drop, ...legacy } = initialState()
    void _drop
    expect(deserialize(JSON.stringify(legacy), words).autoSpeak).toBe(true)
    expect(deserialize(JSON.stringify(initialState('el-ru', false)), words).autoSpeak).toBe(false)
  })
})

describe('loadState/saveState', () => {
  it('saves under STORAGE_KEY and loads back', () => {
    const storage = new MemoryStorage()
    const s = { ...initialState(), learned: [3], score: 1, bestStreak: 1, lastId: 3 }
    saveState(storage, s)
    expect(storage.getItem(STORAGE_KEY)).toBe(serialize(s))
    expect(loadState(storage, words)).toEqual(s)
  })

  it('saveState swallows storage errors', () => {
    const broken = {
      setItem() {
        throw new Error('quota')
      },
    }
    expect(() => saveState(broken, initialState())).not.toThrow()
  })
})
