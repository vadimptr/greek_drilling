export interface TrueFalseTask {
  type: 'tf'
  title: string
  intro: string
  text: string
  items: { statement: string; answer: boolean }[]
}

export interface MatchTask {
  type: 'match'
  title: string
  intro: string
  text: string
  lefts: string[]
  /** Правых вариантов на 2 больше, чем левых */
  rights: string[]
  /** answer[i] — индекс в rights для lefts[i] */
  answer: number[]
}

export interface ChoiceTask {
  type: 'mc'
  title: string
  intro: string
  text: string
  items: { question: string; options: string[]; answer: number }[]
}

export interface GapTask {
  type: 'gap'
  title: string
  intro: string
  /** Текст с плейсхолдерами {{1}} … {{n}} */
  text: string
  /** Банк слов, на 2 больше, чем пропусков */
  bank: string[]
  /** answer[i] — индекс в bank для пропуска i+1 */
  answer: number[]
}

export type ReadingTask = TrueFalseTask | MatchTask | ChoiceTask | GapTask

export interface LanguageItem {
  prompt: string
  options: string[]
  answer: number
  kind: 'grammar' | 'vocab'
}

export interface MockVariant {
  id: number
  title: string
  reading: ReadingTask[]
  language: LanguageItem[]
}

/** Ответы на задания чтения: по заданию — массив индексов (для tf: 1 = Σωστό, 0 = Λάθος), null = нет ответа */
export type ReadingAnswers = (number | null)[][]
export type LanguageAnswers = (number | null)[]

export interface MockAttempt {
  date: string
  variantId: number
  reading: number
  language: number
  passed: boolean
}

export interface MockState {
  history: MockAttempt[]
  /** Индекс следующего варианта в списке */
  nextVariant: number
}
