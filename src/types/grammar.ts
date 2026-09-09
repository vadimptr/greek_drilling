export interface GrammarQuestion {
  /** `${lessonId}-${n}` */
  id: string
  /** Предложение с пропуском `___` или вопрос */
  prompt: string
  options: string[]
  /** Индекс правильного варианта */
  answer: number
  /** Пояснение по-русски, показывается при ошибке */
  explain?: string
}

export type LessonSection =
  | { type: 'text'; text: string }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'examples'; items: { el: string; ru: string }[] }
  | { type: 'note'; text: string }

export interface Lesson {
  /** 1..N, порядок = сложность */
  id: number
  title: string
  summary: string
  sections: LessonSection[]
  questions: GrammarQuestion[]
}

export interface GrammarState {
  completed: number[]
  score: number
  bestStreak: number
  active: { lessonId: number; queue: string[] } | null
}
