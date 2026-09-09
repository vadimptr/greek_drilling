import { describe, expect, it } from 'vitest'
import type { Lesson } from '../types/grammar'
import { abandonLesson, answerLesson, currentQuestionId, initialGrammarState, startLesson } from './lesson'

const lesson: Lesson = {
  id: 3,
  title: 't',
  summary: 's',
  sections: [],
  questions: [
    { id: '3-1', prompt: 'a ___', options: ['x', 'y'], answer: 0 },
    { id: '3-2', prompt: 'b ___', options: ['x', 'y'], answer: 1 },
    { id: '3-3', prompt: 'c ___', options: ['x', 'y'], answer: 0 },
  ],
}

const identityRng = () => 0.999 // shuffle с таким rng оставляет порядок

describe('lesson flow', () => {
  it('startLesson puts all question ids into the queue', () => {
    const s = startLesson(initialGrammarState(), lesson, identityRng)
    expect(s.active?.lessonId).toBe(3)
    expect([...(s.active?.queue ?? [])].sort()).toEqual(['3-1', '3-2', '3-3'])
    expect(currentQuestionId(s)).toBe(s.active?.queue[0])
  })

  it('correct answer removes head and adds a point', () => {
    let s = startLesson(initialGrammarState(), lesson, identityRng)
    const first = currentQuestionId(s)
    s = answerLesson(s, true)
    expect(s.score).toBe(1)
    expect(s.bestStreak).toBe(1)
    expect(s.active?.queue).toHaveLength(2)
    expect(s.active?.queue).not.toContain(first)
  })

  it('wrong answer moves head to the end and resets score', () => {
    let s = startLesson(initialGrammarState(), lesson, identityRng)
    s = answerLesson(s, true)
    const head = currentQuestionId(s)
    s = answerLesson(s, false)
    expect(s.score).toBe(0)
    expect(s.bestStreak).toBe(1)
    expect(s.active?.queue).toHaveLength(2)
    expect(s.active?.queue[1]).toBe(head)
  })

  it('single remaining question stays after a wrong answer', () => {
    let s = startLesson(initialGrammarState(), lesson, identityRng)
    s = answerLesson(s, true)
    s = answerLesson(s, true)
    const last = currentQuestionId(s)
    s = answerLesson(s, false)
    expect(s.active?.queue).toEqual([last])
  })

  it('empty queue completes the lesson without duplicates', () => {
    let s = startLesson({ ...initialGrammarState(), completed: [3] }, lesson, identityRng)
    s = answerLesson(s, true)
    s = answerLesson(s, true)
    s = answerLesson(s, true)
    expect(s.active).toBeNull()
    expect(s.completed).toEqual([3])
    expect(s.score).toBe(3)
  })

  it('answerLesson without active lesson is a no-op', () => {
    const s = initialGrammarState()
    expect(answerLesson(s, true)).toBe(s)
  })

  it('abandonLesson clears active but keeps score and completed', () => {
    let s = startLesson({ ...initialGrammarState(), completed: [1], score: 4, bestStreak: 9 }, lesson, identityRng)
    s = abandonLesson(s)
    expect(s.active).toBeNull()
    expect(s.completed).toEqual([1])
    expect(s.score).toBe(4)
    expect(s.bestStreak).toBe(9)
  })
})
