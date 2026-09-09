import type {
  LanguageAnswers,
  MockAttempt,
  MockState,
  MockVariant,
  ReadingAnswers,
  ReadingTask,
} from '../types/mock'

/** Доля правильных ответов для сдачи части (официально 60%). */
export const PASS_RATIO = 0.6

/** Официальные баллы за задания части «чтение»: 7 + 6 + 6 + 6 = 25. */
export const TASK_POINTS: Record<ReadingTask['type'], number> = { tf: 7, match: 6, mc: 6, gap: 6 }

export const READING_MINUTES = 30
export const LANGUAGE_MINUTES = 20
const HISTORY_LIMIT = 20

export function itemCount(task: ReadingTask): number {
  switch (task.type) {
    case 'tf':
      return task.items.length
    case 'match':
      return task.lefts.length
    case 'mc':
      return task.items.length
    case 'gap':
      return task.answer.length
  }
}

export function correctAnswers(task: ReadingTask): number[] {
  switch (task.type) {
    case 'tf':
      return task.items.map((i) => (i.answer ? 1 : 0))
    case 'match':
      return task.answer
    case 'mc':
      return task.items.map((i) => i.answer)
    case 'gap':
      return task.answer
  }
}

export function emptyReadingAnswers(variant: MockVariant): ReadingAnswers {
  return variant.reading.map((task) => Array<number | null>(itemCount(task)).fill(null))
}

export function emptyLanguageAnswers(variant: MockVariant): LanguageAnswers {
  return Array<number | null>(variant.language.length).fill(null)
}

/** Количество верных пунктов в задании. */
export function countCorrect(task: ReadingTask, answers: (number | null)[]): number {
  const correct = correctAnswers(task)
  return correct.reduce((acc, c, i) => acc + (answers[i] === c ? 1 : 0), 0)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export interface ReadingResult {
  perTask: number[]
  correctPerTask: number[]
  total: number
  max: number
}

export function gradeReading(variant: MockVariant, answers: ReadingAnswers): ReadingResult {
  const correctPerTask = variant.reading.map((task, i) => countCorrect(task, answers[i] ?? []))
  const perTask = variant.reading.map((task, i) =>
    round1((correctPerTask[i] * TASK_POINTS[task.type]) / itemCount(task)),
  )
  const max = variant.reading.reduce((acc, task) => acc + TASK_POINTS[task.type], 0)
  return { perTask, correctPerTask, total: round1(perTask.reduce((a, b) => a + b, 0)), max }
}

export interface LanguageResult {
  total: number
  max: number
}

export function gradeLanguage(variant: MockVariant, answers: LanguageAnswers): LanguageResult {
  const total = variant.language.reduce((acc, item, i) => acc + (answers[i] === item.answer ? 1 : 0), 0)
  return { total, max: variant.language.length }
}

export function isPassed(total: number, max: number): boolean {
  return max > 0 && total / max >= PASS_RATIO
}

export function initialMockState(): MockState {
  return { history: [], nextVariant: 0 }
}

export function recordAttempt(state: MockState, attempt: MockAttempt, variantCount: number): MockState {
  return {
    history: [attempt, ...state.history].slice(0, HISTORY_LIMIT),
    nextVariant: variantCount > 0 ? (state.nextVariant + 1) % variantCount : 0,
  }
}
