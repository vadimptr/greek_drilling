import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import { OPTION_COUNT, buildOptions, labelOf, promptOf, shuffle } from './options'

const words: Word[] = [
  { id: 1, el: 'το σπίτι', ru: 'дом', pos: 'noun', topic: 'home' },
  { id: 2, el: 'το νερό', ru: 'вода', pos: 'noun', topic: 'food' },
  { id: 3, el: 'ο άνθρωπος', ru: 'человек', pos: 'noun', topic: 'people' },
  { id: 4, el: 'η πόλη', ru: 'город', pos: 'noun', topic: 'city' },
  { id: 5, el: 'το ψωμί', ru: 'хлеб', pos: 'noun', topic: 'food' },
  { id: 6, el: 'τρώω', ru: 'есть', pos: 'verb', topic: 'verbs' },
  { id: 7, el: 'πίνω', ru: 'пить', pos: 'verb', topic: 'verbs' },
  { id: 8, el: 'καλός', ru: 'хороший', pos: 'adj', topic: 'adj' },
  { id: 9, el: 'άλλο νερό', ru: 'вода', pos: 'noun', topic: 'dup' },
]

const rng = () => 0.5

describe('labelOf / promptOf', () => {
  it('labelOf returns ru for el-ru and el for ru-el', () => {
    expect(labelOf(words[0], 'el-ru')).toBe('дом')
    expect(labelOf(words[0], 'ru-el')).toBe('το σπίτι')
  })

  it('promptOf is the opposite side', () => {
    expect(promptOf(words[0], 'el-ru')).toBe('το σπίτι')
    expect(promptOf(words[0], 'ru-el')).toBe('дом')
  })
})

describe('shuffle', () => {
  it('returns a permutation and does not mutate input', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input, Math.random)
    expect(out).toHaveLength(5)
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
    expect(input).toEqual([1, 2, 3, 4, 5])
  })
})

describe('buildOptions', () => {
  it('returns 4 options including the target, all labels unique', () => {
    const target = words[0]
    const opts = buildOptions(target, words, 'el-ru', rng)
    expect(opts).toHaveLength(OPTION_COUNT)
    expect(opts.some((o) => o.id === target.id)).toBe(true)
    const labels = opts.map((o) => labelOf(o, 'el-ru'))
    expect(new Set(labels).size).toBe(OPTION_COUNT)
  })

  it('prefers same part of speech', () => {
    const target = words[0]
    const opts = buildOptions(target, words, 'el-ru', rng)
    expect(opts.every((o) => o.pos === 'noun')).toBe(true)
  })

  it('falls back to other parts of speech when same pos is scarce', () => {
    const target = words[5] // τρώω, единственный другой глагол — πίνω
    const opts = buildOptions(target, words, 'el-ru', rng)
    expect(opts).toHaveLength(OPTION_COUNT)
    expect(opts.some((o) => o.id === 7)).toBe(true)
  })

  it('excludes distractors whose label equals the target label', () => {
    const target = words[1] // вода
    for (let i = 0; i < 20; i++) {
      const opts = buildOptions(target, words, 'el-ru', Math.random)
      expect(opts.filter((o) => labelOf(o, 'el-ru') === 'вода')).toHaveLength(1)
    }
  })

  it('returns fewer options when dictionary is too small', () => {
    const opts = buildOptions(words[0], words.slice(0, 2), 'el-ru', rng)
    expect(opts).toHaveLength(2)
  })
})
