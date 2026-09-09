import type { Lesson } from '../../types/grammar'
import { LESSONS_01_10 } from './lessons-01-10'
import { LESSONS_11_20 } from './lessons-11-20'
import { LESSONS_21_30 } from './lessons-21-30'

export const LESSONS: Lesson[] = [...LESSONS_01_10, ...LESSONS_11_20, ...LESSONS_21_30]

export const LESSON_IDS = LESSONS.map((l) => l.id)

export function lessonById(id: number): Lesson | undefined {
  return LESSONS.find((l) => l.id === id)
}
