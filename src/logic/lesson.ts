import type { GrammarState, Lesson } from '../types/grammar'
import { shuffle } from './options'
import type { Rng } from './pick'

export function initialGrammarState(): GrammarState {
  return { completed: [], score: 0, bestStreak: 0, active: null }
}

export function startLesson(state: GrammarState, lesson: Lesson, rng: Rng = Math.random): GrammarState {
  return {
    ...state,
    active: { lessonId: lesson.id, queue: shuffle(lesson.questions.map((q) => q.id), rng) },
  }
}

export function currentQuestionId(state: GrammarState): string | null {
  return state.active?.queue[0] ?? null
}

/**
 * Верный ответ убирает вопрос из очереди; неверный переносит его в конец.
 * Когда очередь пуста, урок попадает в completed, active сбрасывается.
 */
export function answerLesson(state: GrammarState, correct: boolean): GrammarState {
  if (!state.active || state.active.queue.length === 0) return state
  const { lessonId, queue } = state.active
  const [head, ...rest] = queue

  if (!correct) {
    return { ...state, score: 0, active: { lessonId, queue: [...rest, head] } }
  }

  const score = state.score + 1
  const bestStreak = Math.max(state.bestStreak, score)
  if (rest.length === 0) {
    const completed = state.completed.includes(lessonId) ? state.completed : [...state.completed, lessonId]
    return { ...state, score, bestStreak, completed, active: null }
  }
  return { ...state, score, bestStreak, active: { lessonId, queue: rest } }
}

export function abandonLesson(state: GrammarState): GrammarState {
  return { ...state, active: null }
}
