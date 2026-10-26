import type { Lesson } from '../../types/grammar'
import { LEVELS, type Level } from '../../types/word'
import { LESSONS_01_10 } from './lessons-01-10'
import { LESSONS_11_20 } from './lessons-11-20'
import { LESSONS_21_30 } from './lessons-21-30'
import { LESSONS_31_35 } from './lessons-31-35'
import { LESSONS_36_40 } from './lessons-36-40'
import { LESSONS_41_46 } from './lessons-41-46'
import { LESSONS_47_52 } from './lessons-47-52'

const BY_LEVEL: Record<Level, Lesson[]> = {
  A1: [...LESSONS_01_10, ...LESSONS_11_20, ...LESSONS_21_30],
  A2: [...LESSONS_31_35, ...LESSONS_36_40],
  B1: [...LESSONS_41_46, ...LESSONS_47_52],
}

export const LESSONS: Lesson[] = LEVELS.flatMap((l) => BY_LEVEL[l])

export const LESSON_IDS = LESSONS.map((l) => l.id)

const LEVEL_OF = new Map(LEVELS.flatMap((level) => BY_LEVEL[level].map((l) => [l.id, level] as const)))

export function lessonById(id: number): Lesson | undefined {
  return LESSONS.find((l) => l.id === id)
}

export function lessonLevel(id: number): Level {
  return LEVEL_OF.get(id) ?? 'A1'
}

export function lessonsUpTo(level: Level): Lesson[] {
  return LEVELS.slice(0, LEVELS.indexOf(level) + 1).flatMap((l) => BY_LEVEL[l])
}
