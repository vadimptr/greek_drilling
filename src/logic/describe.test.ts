import { describe, expect, it } from 'vitest'
import type { Word } from '../types/word'
import { describeWord } from './describe'

const w = (el: string, pos: Word['pos']): Word => ({ id: 1, el, ru: 'x', pos, topic: 't' })

describe('describeWord: nouns', () => {
  it('masculine singular with typical ending', () => {
    const info = describeWord(w('ο άνθρωπος', 'noun'))
    expect(info.title).toBe('Существительное')
    expect(info.lines.join(' ')).toContain('мужской')
    expect(info.lines.join(' ')).toContain('артикль «ο»')
    expect(info.lines.join(' ')).toContain('-ος')
    expect(info.lines.join(' ')).toContain('единственное')
  })

  it('feminine singular with typical ending', () => {
    const text = describeWord(w('η πόλη', 'noun')).lines.join(' ')
    expect(text).toContain('женский')
    expect(text).toContain('-η')
    expect(text).not.toContain('исключение')
  })

  it('neuter with -μα ending', () => {
    const text = describeWord(w('το όνομα', 'noun')).lines.join(' ')
    expect(text).toContain('средний')
    expect(text).toContain('-μα')
  })

  it('flags exceptions where ending suggests another gender', () => {
    const text = describeWord(w('η άμμος', 'noun')).lines.join(' ')
    expect(text).toContain('женский')
    expect(text).toContain('исключение')
    const text2 = describeWord(w('το κρέας', 'noun')).lines.join(' ')
    expect(text2).toContain('средний')
    expect(text2).toContain('исключение')
  })

  it('handles accented endings and multi-word nouns', () => {
    expect(describeWord(w('ο καφές', 'noun')).lines.join(' ')).toContain('-ες')
    expect(describeWord(w('το σούπερ μάρκετ', 'noun')).lines.join(' ')).toContain('средний')
  })

  it('unknown ending: relies on article', () => {
    const text = describeWord(w('το μενού', 'noun')).lines.join(' ')
    expect(text).toContain('средний')
    expect(text).toContain('артикль')
  })

  it('plural τα is neuter plural', () => {
    const text = describeWord(w('τα παιδιά', 'noun')).lines.join(' ')
    expect(text).toContain('множественное')
    expect(text).toContain('средний')
  })

  it('plural οι: gender from ending', () => {
    expect(describeWord(w('οι κάλτσες', 'noun')).lines.join(' ')).toContain('женский')
    expect(describeWord(w('οι γονείς', 'noun')).lines.join(' ')).toContain('мужской')
    expect(describeWord(w('οι γονείς', 'noun')).lines.join(' ')).toContain('множественное')
  })
})

describe('describeWord: other parts of speech', () => {
  it('adjective on -ος explains feminine and neuter forms', () => {
    const info = describeWord(w('καλός', 'adj'))
    expect(info.title).toBe('Прилагательное')
    expect(info.lines.join(' ')).toContain('-η')
  })

  it('indeclinable colour adjective', () => {
    expect(describeWord(w('μπλε', 'adj')).lines.join(' ')).toContain('Не склоняется')
  })

  it('verbs: regular, deponent and impersonal', () => {
    expect(describeWord(w('τρώω', 'verb')).lines.join(' ')).toContain('1-е лицо')
    expect(describeWord(w('κοιμάμαι', 'verb')).lines.join(' ')).toContain('-μαι')
    expect(describeWord(w('πρέπει', 'verb')).lines.join(' ')).toContain('Безличн')
  })

  it('ordinal numeral', () => {
    expect(describeWord(w('πρώτος', 'num')).lines.join(' ')).toContain('Порядковое')
    expect(describeWord(w('δύο', 'num')).lines.join(' ')).toContain('Количественное')
  })

  it('phrase and other have a title', () => {
    expect(describeWord(w('γεια σου', 'phrase')).title).toBe('Фраза')
    expect(describeWord(w('ναι', 'other')).title).toBe('Служебное слово')
  })
})
