import { describe, expect, it } from 'vitest'
import type { NounEntry } from '../data/nouns'
import {
  analyses,
  article,
  checkIdentify,
  describeAnalyses,
  genderOf,
  makeNounTask,
  withArticle,
} from './nouns'

const e = (el: string, ...forms: string[]): NounEntry => ({ el, forms: forms as NounEntry['forms'] })
const βιβλίο = e('το βιβλίο', 'βιβλίο', 'βιβλίου', 'βιβλίο', 'βιβλία', 'βιβλίων', 'βιβλία')
const γυναίκα = e('η γυναίκα', 'γυναίκα', 'γυναίκας', 'γυναίκα', 'γυναίκες', 'γυναικών', 'γυναίκες')
const άνθρωπος = e('ο άνθρωπος', 'άνθρωπος', 'ανθρώπου', 'άνθρωπο', 'άνθρωποι', 'ανθρώπων', 'ανθρώπους')
const seq = (...vals: number[]) => {
  let i = 0
  return () => vals[i++ % vals.length]
}

describe('articles', () => {
  it('derives gender from the dictionary article', () => {
    expect(genderOf(βιβλίο)).toBe('n')
    expect(genderOf(γυναίκα)).toBe('f')
    expect(genderOf(άνθρωπος)).toBe('m')
  })

  it('keeps or drops final ν of την by the following sound', () => {
    expect(article('f', 'acc', 'sg', 'γυναίκα')).toBe('τη')
    expect(article('f', 'acc', 'sg', 'πόρτα')).toBe('την')
    expect(article('f', 'acc', 'sg', 'ώρα')).toBe('την')
    expect(article('f', 'acc', 'sg', 'μπλούζα')).toBe('την')
    expect(article('f', 'acc', 'sg', 'θάλασσα')).toBe('τη')
    expect(article('m', 'acc', 'sg', 'δρόμο')).toBe('τον')
  })

  it('builds full forms', () => {
    expect(withArticle(άνθρωπος, 'gen', 'pl')).toBe('των ανθρώπων')
    expect(withArticle(γυναίκα, 'acc', 'pl')).toBe('τις γυναίκες')
    expect(withArticle(βιβλίο, 'nom', 'pl')).toBe('τα βιβλία')
  })
})

describe('analyses', () => {
  it('lists every case/number that yields the shown form', () => {
    expect(analyses(βιβλίο, 'το βιβλίο')).toEqual([
      { c: 'nom', n: 'sg' },
      { c: 'acc', n: 'sg' },
    ])
    expect(analyses(γυναίκα, 'οι γυναίκες')).toEqual([{ c: 'nom', n: 'pl' }])
    expect(analyses(άνθρωπος, 'τους ανθρώπους')).toEqual([{ c: 'acc', n: 'pl' }])
    expect(analyses(άνθρωπος, 'ανθρώπους')).toEqual([])
  })

  it('describes analyses in Russian', () => {
    expect(describeAnalyses(βιβλίο, [{ c: 'nom', n: 'sg' }, { c: 'acc', n: 'sg' }])).toBe(
      'средний род, именительный или винительный падеж, единственное число',
    )
    expect(describeAnalyses(άνθρωπος, [{ c: 'gen', n: 'pl' }])).toBe('мужской род, родительный падеж, множественное число')
  })
})

describe('makeNounTask', () => {
  it('identify: shows a form with article and accepts any valid analysis with the right gender', () => {
    const task = makeNounTask(βιβλίο, seq(0.1, 0.0, 0.0))
    expect(task.kind).toBe('identify')
    if (task.kind !== 'identify') return
    expect(task.shown).toBe('το βιβλίο')
    expect(checkIdentify(task, { g: 'n', c: 'nom', n: 'sg' })).toBe(true)
    expect(checkIdentify(task, { g: 'n', c: 'acc', n: 'sg' })).toBe(true)
    expect(checkIdentify(task, { g: 'm', c: 'nom', n: 'sg' })).toBe(false)
    expect(checkIdentify(task, { g: 'n', c: 'gen', n: 'sg' })).toBe(false)
  })

  it('transform: target differs from source, 4 unique options with the answer', () => {
    for (let s = 0; s < 30; s++) {
      const task = makeNounTask(άνθρωπος, seq(0.9, s / 30, ((s * 7) % 30) / 30, 0.3, 0.6, 0.8))
      expect(task.kind).toBe('transform')
      if (task.kind !== 'transform') return
      expect(task.source).toMatch(/^(ο|του|τον|οι|των|τους) /)
      expect(task.options).toHaveLength(4)
      expect(new Set(task.options).size).toBe(4)
      expect(task.options).toContain(task.answer)
      expect(task.answer).toBe(άνθρωπος.forms[task.answerIndex])
      expect(task.source.split(' ')[1]).not.toBe(task.answer)
    }
  })

  it('transform for a neuter never asks to produce the same string', () => {
    for (let s = 0; s < 30; s++) {
      const task = makeNounTask(βιβλίο, seq(0.9, s / 30, ((s * 11) % 30) / 30, 0.2, 0.5, 0.7))
      if (task.kind !== 'transform') return
      expect(task.source.split(' ')[1]).not.toBe(task.answer)
    }
  })
})
