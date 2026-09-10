import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import { levenshtein, matchesWord, normalizeGreek, numeralValue, stripArticle } from './match'

const w = (el: string, pos: Word['pos'] = 'noun'): Word => ({ id: 1, el, ru: '', pos, topic: 't' })

describe('normalizeGreek', () => {
  it('lowercases, strips accents and punctuation, maps final sigma', () => {
    expect(normalizeGreek('Καλημέρα!')).toBe('καλημερα')
    expect(normalizeGreek('  Ο   Άνδρας. ')).toBe('ο ανδρασ')
    expect(normalizeGreek('πώς σε λένε;')).toBe('πωσ σε λενε')
    expect(normalizeGreek('Ναι, ευχαριστώ')).toBe('ναι ευχαριστω')
    expect(normalizeGreek('ϊ ΐ ϋ')).toBe('ι ι υ')
  })
})

describe('stripArticle', () => {
  it('removes a leading definite article only', () => {
    expect(stripArticle('το σπιτι')).toBe('σπιτι')
    expect(stripArticle('η γυναικα')).toBe('γυναικα')
    expect(stripArticle('οι ανθρωποι')).toBe('ανθρωποι')
    expect(stripArticle('τα παιδια')).toBe('παιδια')
    expect(stripArticle('οχι')).toBe('οχι')
    expect(stripArticle('η')).toBe('η')
  })
})

describe('levenshtein', () => {
  it('counts edits', () => {
    expect(levenshtein('abc', 'abc')).toBe(0)
    expect(levenshtein('abc', 'abd')).toBe(1)
    expect(levenshtein('abc', 'ab')).toBe(1)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })
})

describe('numeralValue', () => {
  it('maps greek numerals to integers', () => {
    expect(numeralValue('πεντε')).toBe(5)
    expect(numeralValue('δεκατεσσερα')).toBe(14)
    expect(numeralValue('εκατο')).toBe(100)
    expect(numeralValue('χιλια')).toBe(1000)
    expect(numeralValue('μηδεν')).toBe(0)
    expect(numeralValue('πρωτοσ')).toBeNull()
    expect(numeralValue('σπιτι')).toBeNull()
  })
})

describe('matchesWord', () => {
  it('accepts exact and case/accent-insensitive matches', () => {
    expect(matchesWord('Καλημέρα.', w('καλημέρα', 'phrase'))).toBe(true)
    expect(matchesWord('το σπίτι', w('το σπίτι'))).toBe(true)
    expect(matchesWord('ΤΟ ΣΠΙΤΙ', w('το σπίτι'))).toBe(true)
  })

  it('accepts a noun with or without its article', () => {
    expect(matchesWord('σπίτι', w('το σπίτι'))).toBe(true)
    expect(matchesWord('η γυναίκα', w('γυναίκα'))).toBe(true)
  })

  it('tolerates one recognition slip for words of 5+ letters and two for 9+', () => {
    expect(matchesWord('καλιμέρα', w('καλημέρα', 'phrase'))).toBe(true)
    expect(matchesWord('ευχαριστό', w('ευχαριστώ', 'phrase'))).toBe(true)
    expect(matchesWord('εφχαριστο', w('ευχαριστώ', 'phrase'))).toBe(true)
    expect(matchesWord('δεκατεσερα', w('δεκατέσσερα', 'num'))).toBe(true)
  })

  it('does not tolerate slips in short words', () => {
    expect(matchesWord('νέο', w('ναι', 'other'))).toBe(false)
    expect(matchesWord('όχι', w('ναι', 'other'))).toBe(false)
    expect(matchesWord('έξω', w('έξι', 'num'))).toBe(false)
  })

  it('rejects different words even of similar length', () => {
    expect(matchesWord('το τραπέζι', w('το σπίτι'))).toBe(false)
    expect(matchesWord('η γάτα', w('ο σκύλος'))).toBe(false)
    expect(matchesWord('', w('το σπίτι'))).toBe(false)
  })

  it('accepts digits for numerals', () => {
    expect(matchesWord('5', w('πέντε', 'num'))).toBe(true)
    expect(matchesWord('14.', w('δεκατέσσερα', 'num'))).toBe(true)
    expect(matchesWord('100', w('εκατό', 'num'))).toBe(true)
    expect(matchesWord('6', w('πέντε', 'num'))).toBe(false)
    expect(matchesWord('5', w('πέντε λεπτά', 'phrase'))).toBe(false)
  })

  it('accepts the target word when whisper adds filler around it', () => {
    expect(matchesWord('Ναι, καλημέρα.', w('καλημέρα', 'phrase'))).toBe(true)
    expect(matchesWord('το σπίτι μου', w('το σπίτι'))).toBe(true)
    // короткие цели внутри чужой фразы не засчитываем
    expect(matchesWord('και εγώ', w('και', 'conj'))).toBe(false)
  })

  it('handles multi-word phrases with spacing differences', () => {
    expect(matchesWord('πώς σε λένε', w('πώς σε λένε;', 'phrase'))).toBe(true)
    expect(matchesWord('πως σελένε', w('πώς σε λένε;', 'phrase'))).toBe(true)
    expect(matchesWord('τι κάνεις', w('πώς σε λένε;', 'phrase'))).toBe(false)
  })
})
