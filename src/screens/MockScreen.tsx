import { useCallback, useEffect, useState } from 'react'
import { VARIANTS } from '../data/mock'
import {
  emptyLanguageAnswers,
  emptyReadingAnswers,
  gradeLanguage,
  gradeReading,
  isPassed,
  LANGUAGE_MINUTES,
  PASS_RATIO,
  READING_MINUTES,
  recordAttempt,
} from '../logic/mock'
import type { LanguageAnswers, MockState, MockVariant, ReadingAnswers } from '../types/mock'
import { MockResult } from '../components/mock/MockResult'
import { ReadingTaskView, TaskText } from '../components/mock/ReadingTasks'
import { Timer } from '../components/mock/Timer'

type Mode = 'start' | 'reading' | 'language' | 'result'

interface Props {
  state: MockState
  onChange: (next: MockState) => void
}

const LETTERS = ['α', 'β', 'γ']

export function MockScreen({ state, onChange }: Props) {
  const [mode, setMode] = useState<Mode>('start')
  const [variant, setVariant] = useState<MockVariant>(VARIANTS[state.nextVariant % VARIANTS.length])
  const [reading, setReading] = useState<ReadingAnswers>([])
  const [language, setLanguage] = useState<LanguageAnswers>([])
  const [taskIndex, setTaskIndex] = useState(0)
  const [endsAt, setEndsAt] = useState(0)

  // новый экран/задание — прокрутить наверх
  useEffect(() => {
    document.querySelector('.screen')?.scrollTo({ top: 0 })
  }, [mode, taskIndex])

  const start = () => {
    const v = VARIANTS[state.nextVariant % VARIANTS.length]
    setVariant(v)
    setReading(emptyReadingAnswers(v))
    setLanguage(emptyLanguageAnswers(v))
    setTaskIndex(0)
    setEndsAt(Date.now() + READING_MINUTES * 60_000)
    setMode('reading')
  }

  const toLanguage = useCallback(() => {
    setEndsAt(Date.now() + LANGUAGE_MINUTES * 60_000)
    setMode('language')
  }, [])

  const finish = useCallback(() => {
    const r = gradeReading(variant, reading)
    const l = gradeLanguage(variant, language)
    const passed = isPassed(r.total, r.max) && isPassed(l.total, l.max)
    onChange(
      recordAttempt(
        state,
        { date: new Date().toISOString().slice(0, 10), variantId: variant.id, reading: r.total, language: l.total, passed },
        VARIANTS.length,
      ),
    )
    setMode('result')
  }, [variant, reading, language, state, onChange])

  if (mode === 'start') {
    const best = state.history.reduce<number | null>((acc, a) => {
      const pct = Math.round(((a.reading + a.language) / 50) * 100)
      return acc === null || pct > acc ? pct : acc
    }, null)
    const next = VARIANTS[state.nextVariant % VARIANTS.length]
    return (
      <main className="mock-start">
        <h1 className="explain-title">Мок-экзамен A1</h1>
        <p className="sec-text">
          Формат части «Κατανόηση γραπτού λόγου» повторяет экзамен Ελληνομάθεια A1 Центра греческого языка: 4
          задания, 25 баллов, {READING_MINUTES} минут. Вторая часть — 25 вопросов по грамматике и лексике,{' '}
          {LANGUAGE_MINUTES} минут.
        </p>
        <p className="sec-note">
          Проходной порог — {Math.round(PASS_RATIO * 100)}% по каждой части. Ответы проверяются только в конце,
          как на настоящем экзамене.
        </p>
        <button className="primary-btn" onClick={start}>
          Начать: {next.title}
        </button>
        {best !== null && <div className="mock-best">Лучший результат: {best}%</div>}
        {state.history.length > 0 && (
          <div className="mock-history">
            <div className="sheet-label">Последние попытки</div>
            {state.history.slice(0, 8).map((a, i) => (
              <div key={i} className={a.passed ? 'history-row ok' : 'history-row bad'}>
                <span>{a.date}</span>
                <span>Вариант {a.variantId}</span>
                <span>
                  {a.reading}/25 · {a.language}/25
                </span>
                <span>{a.passed ? 'сдан' : 'не сдан'}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    )
  }

  if (mode === 'reading') {
    const task = variant.reading[taskIndex]
    const isLast = taskIndex === variant.reading.length - 1
    return (
      <main className="mock">
        <div className="mock-top">
          <span className="mock-step">
            Часть А · Задание {taskIndex + 1} из {variant.reading.length}
          </span>
          <Timer endsAt={endsAt} onExpire={toLanguage} />
        </div>
        <h2 className="mock-task-title">{task.title}</h2>
        <p className="mock-intro">{task.intro}</p>
        {task.type !== 'gap' && <TaskText text={task.text} />}
        <ReadingTaskView
          task={task}
          answers={reading[taskIndex] ?? []}
          onChange={(a) => setReading((prev) => prev.map((x, i) => (i === taskIndex ? a : x)))}
        />
        <div className="task-nav">
          <button className="secondary-btn" disabled={taskIndex === 0} onClick={() => setTaskIndex((i) => i - 1)}>
            ← Назад
          </button>
          {isLast ? (
            <button className="primary-btn" onClick={toLanguage}>
              К части Б →
            </button>
          ) : (
            <button className="primary-btn" onClick={() => setTaskIndex((i) => i + 1)}>
              Дальше →
            </button>
          )}
        </div>
      </main>
    )
  }

  if (mode === 'language') {
    const answered = language.filter((a) => a !== null).length
    return (
      <main className="mock">
        <div className="mock-top">
          <span className="mock-step">Часть Б · Грамматика и лексика</span>
          <Timer endsAt={endsAt} onExpire={finish} />
        </div>
        <p className="mock-intro">Выберите правильный вариант. Отвечено {answered} из {variant.language.length}.</p>
        {variant.language.map((item, i) => (
          <div key={i} className="mc-block">
            <div className="mc-question">
              {i + 1}. {item.prompt}
            </div>
            {item.options.map((o, j) => (
              <button
                key={j}
                className={language[i] === j ? 'mc-option mc-on' : 'mc-option'}
                onClick={() => setLanguage((prev) => prev.map((x, k) => (k === i ? j : x)))}
              >
                <span className="mc-letter">{LETTERS[j]}.</span> {o}
              </button>
            ))}
          </div>
        ))}
        <div className="task-nav">
          <button className="primary-btn" onClick={finish}>
            Завершить тест
          </button>
        </div>
      </main>
    )
  }

  return <MockResult variant={variant} reading={reading} language={language} onAgain={() => setMode('start')} />
}
