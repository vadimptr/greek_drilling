import { Fragment, useState } from 'react'
import type { ChoiceTask, GapTask, MatchTask, ReadingTask, TrueFalseTask } from '../../types/mock'

type Answers = (number | null)[]

interface TaskProps<T extends ReadingTask> {
  task: T
  answers: Answers
  onChange: (answers: Answers) => void
}

function setAt(answers: Answers, i: number, v: number | null): Answers {
  const next = [...answers]
  next[i] = v
  return next
}

export function TaskText({ text }: { text: string }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mock-text-wrap">
      <button className="link-btn" onClick={() => setOpen((o) => !o)}>
        {open ? 'Скрыть текст ▲' : 'Показать текст ▼'}
      </button>
      {open && <div className="mock-text">{text}</div>}
    </div>
  )
}

export function TaskTF({ task, answers, onChange }: TaskProps<TrueFalseTask>) {
  return (
    <div className="task-items">
      {task.items.map((item, i) => (
        <div key={i} className="tf-row">
          <div className="tf-statement">
            {i + 1}. {item.statement}
          </div>
          <div className="tf-btns">
            <button className={answers[i] === 1 ? 'tf-btn tf-on' : 'tf-btn'} onClick={() => onChange(setAt(answers, i, 1))}>
              Σωστό
            </button>
            <button className={answers[i] === 0 ? 'tf-btn tf-on' : 'tf-btn'} onClick={() => onChange(setAt(answers, i, 0))}>
              Λάθος
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function TaskMatch({ task, answers, onChange }: TaskProps<MatchTask>) {
  return (
    <div className="task-items">
      <ol className="match-rights">
        {task.rights.map((r, i) => (
          <li key={i}>
            <b>{i + 1}.</b> {r}
          </li>
        ))}
      </ol>
      {task.lefts.map((l, i) => (
        <div key={i} className="match-row">
          <div className="match-left">{l}</div>
          <select
            className="mock-select"
            value={answers[i] ?? ''}
            onChange={(e) => onChange(setAt(answers, i, e.target.value === '' ? null : Number(e.target.value)))}
          >
            <option value="">—</option>
            {task.rights.map((_, j) => (
              <option key={j} value={j}>
                {j + 1}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}

const LETTERS = ['α', 'β', 'γ', 'δ']

export function TaskMC({ task, answers, onChange }: TaskProps<ChoiceTask>) {
  return (
    <div className="task-items">
      {task.items.map((item, i) => (
        <div key={i} className="mc-block">
          <div className="mc-question">
            {i + 1}. {item.question}
          </div>
          {item.options.map((o, j) => (
            <button
              key={j}
              className={answers[i] === j ? 'mc-option mc-on' : 'mc-option'}
              onClick={() => onChange(setAt(answers, i, j))}
            >
              <span className="mc-letter">{LETTERS[j]}.</span> {o}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

export function TaskGap({ task, answers, onChange }: TaskProps<GapTask>) {
  const parts = task.text.split(/(\{\{\d+\}\})/)
  return (
    <div className="task-items">
      <div className="gap-bank">
        {task.bank.map((w, i) => (
          <span key={i} className="gap-chip">
            {w}
          </span>
        ))}
      </div>
      <div className="mock-text gap-text">
        {parts.map((p, k) => {
          const m = p.match(/^\{\{(\d+)\}\}$/)
          if (!m) return <Fragment key={k}>{p}</Fragment>
          const i = Number(m[1]) - 1
          return (
            <select
              key={k}
              className="mock-select gap-select"
              value={answers[i] ?? ''}
              onChange={(e) => onChange(setAt(answers, i, e.target.value === '' ? null : Number(e.target.value)))}
            >
              <option value="">({i + 1}) …</option>
              {task.bank.map((w, j) => (
                <option key={j} value={j}>
                  {w}
                </option>
              ))}
            </select>
          )
        })}
      </div>
    </div>
  )
}

export function ReadingTaskView({ task, answers, onChange }: TaskProps<ReadingTask>) {
  switch (task.type) {
    case 'tf':
      return <TaskTF task={task} answers={answers} onChange={onChange} />
    case 'match':
      return <TaskMatch task={task} answers={answers} onChange={onChange} />
    case 'mc':
      return <TaskMC task={task} answers={answers} onChange={onChange} />
    case 'gap':
      return <TaskGap task={task} answers={answers} onChange={onChange} />
  }
}
