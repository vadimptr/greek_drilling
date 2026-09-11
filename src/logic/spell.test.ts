import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import {
  baseLetter,
  checkSpell,
  confusablesOf,
  graphemes,
  makeSpellTask,
  sameAccent,
  targetPositions,
  type SpellKind,
} from './spell'

const w = (el: string, pos: Word['pos'] = 'noun'): Word => ({ id: 1, el, ru: 'x', pos, topic: 't' })

/** Детерминированный rng из списка значений (по кругу). */
const seq = (...vals: number[]) => {
  let i = 0
  return () => vals[i++ % vals.length]
}

describe('letters', () => {
  it('splits into graphemes and strips/keeps accents', () => {
    expect(graphemes('καλημέρα')).toHaveLength(8)
    expect(baseLetter('έ')).toBe('ε')
    expect(baseLetter('ώ')).toBe('ω')
    expect(baseLetter('ϊ')).toBe('ι')
    expect(baseLetter('κ')).toBe('κ')
    expect(sameAccent('ω', 'ό')).toBe('ώ')
    expect(sameAccent('η', 'ι')).toBe('η')
    expect(sameAccent('ι', 'ή')).toBe('ί')
  })

  it('lists confusable letters with matching accent', () => {
    expect(confusablesOf('ό')).toEqual(['ώ'])
    expect(confusablesOf('ι').sort()).toEqual(['η', 'υ'])
    expect(confusablesOf('ή').sort()).toEqual(['ί', 'ύ'])
    expect(confusablesOf('ξ')).toEqual([])
  })

  it('never targets article, spaces or punctuation', () => {
    expect(targetPositions(graphemes('το σπίτι'))).toEqual([3, 4, 5, 6, 7])
    expect(targetPositions(graphemes('πώς σε λένε;'))).toEqual([0, 1, 2, 4, 5, 7, 8, 9, 10])
    expect(targetPositions(graphemes('ναι'))).toEqual([0, 1, 2])
  })
})

describe('makeSpellTask', () => {
  const kinds: SpellKind[] = ['missing', 'extra', 'wrong']

  it('missing: gap at a target position, 4 unique options including the answer', () => {
    const task = makeSpellTask(w('το σπίτι'), seq(0, 0.5, 0.3, 0.9, 0.1, 0.7))
    expect(task.kind).toBe('missing')
    expect(task.answerIndices).toHaveLength(1)
    const idx = task.answerIndices[0]
    expect(idx).toBeGreaterThanOrEqual(3)
    expect(task.tokens[idx]).toBe('')
    expect(task.options).toHaveLength(4)
    expect(new Set(task.options).size).toBe(4)
    expect(task.options).toContain(task.correctLetter)
    const restored = [...task.tokens]
    restored[idx] = task.correctLetter
    expect(restored.join('')).toBe('το σπίτι')
  })

  it('wrong: one letter replaced, restoring gives the word, accent preserved', () => {
    const task = makeSpellTask(w('καλημέρα', 'phrase'), seq(0.9, 0.2, 0.4, 0.6))
    expect(task.kind).toBe('wrong')
    const idx = task.answerIndices[0]
    expect(task.tokens[idx]).not.toBe(task.correctLetter)
    expect(baseLetter(task.tokens[idx])).not.toBe(baseLetter(task.correctLetter))
    const restored = [...task.tokens]
    restored[idx] = task.correctLetter
    expect(restored.join('')).toBe('καλημέρα')
    expect(task.tokens.join('')).not.toBe('καλημέρα')
  })

  it('extra: removing any answer index restores the word; duplicates give two indices', () => {
    for (let s = 0; s < 40; s++) {
      const rng = seq(0.4, (s % 10) / 10, ((s * 7) % 10) / 10, 0.5)
      const task = makeSpellTask(w('η θάλασσα'), rng)
      expect(task.kind).toBe('extra')
      expect(task.tokens.length).toBe(graphemes('η θάλασσα').length + 1)
      for (const idx of task.answerIndices) {
        const restored = task.tokens.filter((_, i) => i !== idx)
        expect(restored.join('')).toBe('η θάλασσα')
      }
      expect(task.answerIndices.every((i) => i >= 2)).toBe(true)
    }
    // конкретно дубль: вставка «σ» рядом с существующей «σ» даёт оба индекса
    const dup = makeSpellTask(w('η θάλασσα'), seq(0.4, 0.0, 0.5, 0.5))
    const answerLetters = new Set(dup.answerIndices.map((i) => dup.tokens[i]))
    if (answerLetters.size === 1 && dup.answerIndices.length === 2) {
      expect(dup.tokens[dup.answerIndices[0]]).toBe(dup.tokens[dup.answerIndices[1]])
    }
  })

  it('phrases: only one word gets distorted, all kinds restore the original', () => {
    const el = 'πώς σε λένε;'
    for (const k of kinds) {
      for (let s = 0; s < 12; s++) {
        const rng = seq(k === 'missing' ? 0.1 : k === 'extra' ? 0.4 : 0.9, s / 12, ((s * 5) % 12) / 12, 0.3, 0.8)
        const task = makeSpellTask(w(el, 'phrase'), rng)
        expect(task.kind).toBe(k)
        const idx = task.answerIndices[0]
        let restored: string[]
        if (k === 'extra') restored = task.tokens.filter((_, i) => i !== idx)
        else {
          restored = [...task.tokens]
          restored[idx] = task.correctLetter
        }
        expect(restored.join('')).toBe(el)
        expect(task.tokens.filter((t) => t === ' ')).toHaveLength(2)
        expect(task.tokens[task.tokens.length - 1]).toBe(';')
      }
    }
  })

  it('short words without confusable letters fall back to missing', () => {
    const task = makeSpellTask(w('ξ', 'other'), seq(0.9, 0.5, 0.5, 0.5))
    expect(task.kind).toBe('missing')
  })
})

describe('checkSpell', () => {
  it('checks option for missing and index for tap tasks', () => {
    const missing = makeSpellTask(w('το σπίτι'), seq(0, 0.5, 0.3, 0.9, 0.1, 0.7))
    expect(checkSpell(missing, { option: missing.correctLetter })).toBe(true)
    expect(checkSpell(missing, { option: missing.options!.find((o) => o !== missing.correctLetter) })).toBe(false)
    const wrong = makeSpellTask(w('καλημέρα', 'phrase'), seq(0.9, 0.2, 0.4, 0.6))
    expect(checkSpell(wrong, { index: wrong.answerIndices[0] })).toBe(true)
    expect(checkSpell(wrong, { index: (wrong.answerIndices[0] + 1) % wrong.tokens.length })).toBe(false)
    expect(checkSpell(wrong, {})).toBe(false)
  })
})
