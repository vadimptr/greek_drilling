import type { LanguageAnswers, MockVariant, ReadingAnswers, ReadingTask } from '../../types/mock'
import { correctAnswers, gradeLanguage, gradeReading, isPassed, PASS_RATIO } from '../../logic/mock'

interface Props {
  variant: MockVariant
  reading: ReadingAnswers
  language: LanguageAnswers
  onAgain: () => void
}

function describeAnswer(task: ReadingTask, i: number, value: number | null): string {
  if (value === null) return '—'
  switch (task.type) {
    case 'tf':
      return value === 1 ? 'Σωστό' : 'Λάθος'
    case 'match':
      return task.rights[value] ?? '—'
    case 'mc':
      return task.items[i].options[value] ?? '—'
    case 'gap':
      return task.bank[value] ?? '—'
  }
}

function itemLabel(task: ReadingTask, i: number): string {
  switch (task.type) {
    case 'tf':
      return task.items[i].statement
    case 'match':
      return task.lefts[i]
    case 'mc':
      return task.items[i].question
    case 'gap':
      return `Пропуск ${i + 1}`
  }
}

export function MockResult({ variant, reading, language, onAgain }: Props) {
  const r = gradeReading(variant, reading)
  const l = gradeLanguage(variant, language)
  const readingPassed = isPassed(r.total, r.max)
  const languagePassed = isPassed(l.total, l.max)
  const passed = readingPassed && languagePassed

  return (
    <main className="result">
      <div className={passed ? 'result-banner result-pass' : 'result-banner result-fail'}>
        <div className="result-emoji">{passed ? '🎉' : '📚'}</div>
        <div className="result-title">{passed ? 'Экзамен сдан!' : 'Пока не сдан'}</div>
        <div className="result-sub">Порог — {Math.round(PASS_RATIO * 100)}% по каждой части</div>
      </div>

      <div className="result-parts">
        <div className={readingPassed ? 'result-part ok' : 'result-part bad'}>
          <div className="result-part-title">Чтение</div>
          <div className="result-part-score">
            {r.total} / {r.max}
          </div>
          <div className="result-part-status">{readingPassed ? 'сдано' : 'не сдано'}</div>
        </div>
        <div className={languagePassed ? 'result-part ok' : 'result-part bad'}>
          <div className="result-part-title">Грамматика и лексика</div>
          <div className="result-part-score">
            {l.total} / {l.max}
          </div>
          <div className="result-part-status">{languagePassed ? 'сдано' : 'не сдано'}</div>
        </div>
      </div>

      <button className="primary-btn" onClick={onAgain}>
        Ещё раз
      </button>

      <h2 className="result-h2">Разбор: чтение</h2>
      {variant.reading.map((task, t) => {
        const correct = correctAnswers(task)
        return (
          <section key={t} className="review-task">
            <div className="review-task-title">
              {task.title} — {r.correctPerTask[t]} из {correct.length}
            </div>
            {correct.map((c, i) => {
              const user = reading[t]?.[i] ?? null
              const ok = user === c
              return (
                <div key={i} className={ok ? 'review-item ok' : 'review-item bad'}>
                  <div className="review-q">{itemLabel(task, i)}</div>
                  <div className="review-a">
                    {ok ? '✓ ' : '✗ '}
                    {describeAnswer(task, i, user)}
                    {!ok && <span className="review-correct"> → {describeAnswer(task, i, c)}</span>}
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}

      <h2 className="result-h2">Разбор: грамматика и лексика</h2>
      <section className="review-task">
        {variant.language.map((item, i) => {
          const user = language[i]
          const ok = user === item.answer
          return (
            <div key={i} className={ok ? 'review-item ok' : 'review-item bad'}>
              <div className="review-q">
                {i + 1}. {item.prompt}
              </div>
              <div className="review-a">
                {ok ? '✓ ' : '✗ '}
                {user === null ? '—' : item.options[user]}
                {!ok && <span className="review-correct"> → {item.options[item.answer]}</span>}
              </div>
            </div>
          )
        })}
      </section>
    </main>
  )
}
