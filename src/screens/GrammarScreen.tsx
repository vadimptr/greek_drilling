import { useEffect, useRef, useState } from 'react'
import { LESSONS, lessonById } from '../data/grammar'
import { abandonLesson, answerLesson, currentQuestionId, startLesson } from '../logic/lesson'
import type { GrammarState, Lesson } from '../types/grammar'
import { Exercise, type ExerciseFeedback } from '../components/grammar/Exercise'
import { LessonExplanation } from '../components/grammar/LessonExplanation'
import { LessonList } from '../components/grammar/LessonList'

type Mode = 'list' | 'explain' | 'exercise' | 'done'

const CORRECT_DELAY_MS = 600

interface Props {
  state: GrammarState
  onChange: (next: GrammarState) => void
}

export function GrammarScreen({ state, onChange }: Props) {
  const [mode, setMode] = useState<Mode>(() => (state.active ? 'exercise' : 'list'))
  const [viewLesson, setViewLesson] = useState<Lesson | null>(null)
  const [feedback, setFeedback] = useState<ExerciseFeedback | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [ruleOpen, setRuleOpen] = useState(false)
  const [doneLesson, setDoneLesson] = useState<Lesson | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  // смена экрана — прокрутить наверх
  useEffect(() => {
    document.querySelector('.screen')?.scrollTo({ top: 0 })
  }, [mode, viewLesson])

  const activeLesson = state.active ? lessonById(state.active.lessonId) ?? null : null
  const questionId = currentQuestionId(state)
  const question = activeLesson && questionId ? activeLesson.questions.find((q) => q.id === questionId) ?? null : null

  const openLesson = (lesson: Lesson) => {
    setViewLesson(lesson)
    setMode('explain')
  }

  const begin = () => {
    if (!viewLesson) return
    onChange(startLesson(state, viewLesson))
    setFeedback(null)
    setAttempt((a) => a + 1)
    setMode('exercise')
  }

  const select = (optionIndex: number) => {
    if (!question || feedback) return
    const correct = optionIndex === question.answer
    setFeedback({ chosen: optionIndex, correct })
    if (correct) {
      const next = answerLesson(state, true)
      timer.current = window.setTimeout(() => {
        timer.current = null
        setFeedback(null)
        setAttempt((a) => a + 1)
        onChange(next)
        if (next.active === null) {
          setDoneLesson(activeLesson)
          setMode('done')
        }
      }, CORRECT_DELAY_MS)
    } else {
      // очки сбрасываются сразу, перенос вопроса в конец очереди — по кнопке «Дальше»
      onChange({ ...state, score: 0 })
    }
  }

  const next = () => {
    if (!feedback) return
    onChange(answerLesson(state, false))
    setFeedback(null)
    setAttempt((a) => a + 1)
  }

  const exit = () => {
    onChange(abandonLesson(state))
    setFeedback(null)
    setMode('list')
  }

  if (mode === 'exercise' && (!activeLesson || !question)) {
    // состояние потеряно (например, урок удалён) — вернуться к списку
    return (
      <LessonList
        lessons={LESSONS}
        completed={state.completed}
        activeLessonId={null}
        onOpen={openLesson}
        onResume={() => setMode('exercise')}
      />
    )
  }

  if (mode === 'list') {
    return (
      <LessonList
        lessons={LESSONS}
        completed={state.completed}
        activeLessonId={state.active?.lessonId ?? null}
        onOpen={openLesson}
        onResume={() => setMode('exercise')}
      />
    )
  }

  if (mode === 'explain' && viewLesson) {
    const resumeSame = state.active?.lessonId === viewLesson.id
    return (
      <LessonExplanation
        lesson={viewLesson}
        primaryLabel={resumeSame ? 'Продолжить упражнения' : 'К упражнениям'}
        onPrimary={resumeSame ? () => setMode('exercise') : begin}
        onBack={() => setMode('list')}
      />
    )
  }

  if (mode === 'done' && doneLesson) {
    const nextLesson = LESSONS.find((l) => l.id === doneLesson.id + 1)
    return (
      <main className="done">
        <div className="done-emoji">🎯</div>
        <h1 className="done-title">Урок {doneLesson.id} пройден!</h1>
        <p className="done-sub">{doneLesson.title}</p>
        {nextLesson && (
          <button className="primary-btn" onClick={() => openLesson(nextLesson)}>
            Следующий: {nextLesson.title}
          </button>
        )}
        <button className="secondary-btn" onClick={() => setMode('list')}>
          К списку уроков
        </button>
      </main>
    )
  }

  if (activeLesson && question && state.active) {
    return (
      <>
        <Exercise
          question={question}
          attempt={attempt}
          remaining={state.active.queue.length}
          feedback={feedback}
          onSelect={select}
          onNext={next}
          onShowRule={() => setRuleOpen(true)}
          onExit={exit}
        />
        {ruleOpen && (
          <div className="sheet-backdrop" onClick={() => setRuleOpen(false)}>
            <div className="sheet sheet-tall" onClick={(e) => e.stopPropagation()}>
              <LessonExplanation
                lesson={activeLesson}
                primaryLabel="Понятно"
                onPrimary={() => setRuleOpen(false)}
                onBack={() => setRuleOpen(false)}
                backLabel="← Назад"
              />
            </div>
          </div>
        )}
      </>
    )
  }

  return null
}
