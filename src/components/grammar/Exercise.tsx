import { useMemo } from 'react'
import type { GrammarQuestion } from '../../types/grammar'
import { shuffle } from '../../logic/options'

export interface ExerciseFeedback {
  chosen: number
  correct: boolean
}

interface Props {
  question: GrammarQuestion
  /** Меняется при каждом новом показе вопроса, чтобы варианты перемешивались заново */
  attempt: number
  remaining: number
  feedback: ExerciseFeedback | null
  onSelect: (optionIndex: number) => void
  onNext: () => void
  onShowRule: () => void
  onExit: () => void
}

export function Exercise({ question, attempt, remaining, feedback, onSelect, onNext, onShowRule, onExit }: Props) {
  const order = useMemo(
    () => shuffle(question.options.map((_, i) => i), Math.random),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id, attempt],
  )

  return (
    <>
      <div className="exercise-top">
        <button className="link-btn" onClick={onExit}>
          ← Выйти
        </button>
        <span className="exercise-left">Осталось {remaining}</span>
        <button className="link-btn" onClick={onShowRule}>
          Правило
        </button>
      </div>
      <main className="prompt">
        <div key={`${question.id}-${attempt}`} className="exercise-prompt">
          {question.prompt}
        </div>
      </main>
      <section className="options">
        {order.map((i) => {
          let cls = 'option option-small'
          if (feedback) {
            if (i === question.answer) cls += ' option-correct'
            else if (i === feedback.chosen) cls += ' option-wrong'
            else cls += ' option-dim'
          }
          return (
            <button key={i} className={cls} disabled={feedback !== null} onClick={() => onSelect(i)}>
              {question.options[i]}
            </button>
          )
        })}
        {feedback && !feedback.correct && (
          <div className="explain-box">
            <div className="explain-box-text">{question.explain}</div>
            <button className="primary-btn" onClick={onNext}>
              Дальше
            </button>
          </div>
        )}
      </section>
    </>
  )
}
