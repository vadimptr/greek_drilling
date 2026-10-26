import { Fragment } from 'react'
import { lessonLevel } from '../../data/grammar'
import type { Lesson } from '../../types/grammar'

interface Props {
  lessons: Lesson[]
  completed: number[]
  activeLessonId: number | null
  onOpen: (lesson: Lesson) => void
  onResume: () => void
}

export function LessonList({ lessons, completed, activeLessonId, onOpen, onResume }: Props) {
  const done = new Set(completed)
  const active = activeLessonId !== null ? lessons.find((l) => l.id === activeLessonId) : undefined
  const multiLevel = lessons.length > 0 && lessonLevel(lessons[0].id) !== lessonLevel(lessons[lessons.length - 1].id)
  return (
    <main className="lesson-list">
      {active && (
        <button className="resume-card" onClick={onResume}>
          <span className="resume-title">Продолжить урок {active.id}</span>
          <span className="resume-sub">{active.title}</span>
        </button>
      )}
      {lessons.map((l, i) => {
        const level = lessonLevel(l.id)
        const levelStart = multiLevel && (i === 0 || lessonLevel(lessons[i - 1].id) !== level)
        return (
          <Fragment key={l.id}>
            {levelStart && <div className="lesson-level">Уровень {level}</div>}
            <button className={done.has(l.id) ? 'lesson-card lesson-done' : 'lesson-card'} onClick={() => onOpen(l)}>
              <span className="lesson-num">{done.has(l.id) ? '✓' : l.id}</span>
              <span className="lesson-body">
                <span className="lesson-title">{l.title}</span>
                <span className="lesson-summary">{l.summary}</span>
              </span>
            </button>
          </Fragment>
        )
      })}
    </main>
  )
}
