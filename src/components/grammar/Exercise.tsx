import { useEffect, useMemo } from 'react'
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLInputElement) return
      if (feedback) {
        if (!feedback.correct && e.key === 'Enter') onNext()
        return
      }
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= order.length) onSelect(order[n - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [feedback, order, onSelect, onNext])

  const promptClass = !feedback ? 'trainer-prompt' : feedback.correct ? 'trainer-prompt trainer-prompt-ok' : 'trainer-prompt trainer-prompt-bad'

  return (
    <main className="nouns trainer">
      <div className="trainer-card">
        <div className="exercise-top">
          <button className="link-btn" onClick={onExit}>
            ← Выйти
          </button>
          <span className="exercise-left">Осталось {remaining}</span>
          <button className="link-btn" onClick={onShowRule}>
            Правило
          </button>
        </div>
        <div key={`${question.id}-${attempt}-${feedback ? (feedback.correct ? 'ok' : 'bad') : ''}`} className={promptClass}>
          <div className="exercise-prompt">{question.prompt}</div>
          {feedback && !feedback.correct && <div className="explain-box-text">{question.explain}</div>}
        </div>
        <div className="trainer-answers">
          <section className="options">
            {order.map((i, n) => {
              let cls = 'option option-small'
              if (feedback) {
                if (i === question.answer) cls += ' option-correct'
                else if (i === feedback.chosen) cls += ' option-wrong'
                else cls += ' option-dim'
              }
              return (
                <button key={i} className={cls} disabled={feedback !== null} onClick={() => onSelect(i)}>
                  <span className="option-key">{n + 1}</span>
                  <span className="option-text">{question.options[i]}</span>
                </button>
              )
            })}
          </section>
          {feedback && !feedback.correct && (
            <button className="primary-btn trainer-next" onClick={onNext}>
              Дальше <span className="option-key option-key-light">Enter</span>
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
