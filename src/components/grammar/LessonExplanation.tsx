import type { Lesson, LessonSection } from '../../types/grammar'
import { canSpeak, speak } from '../../logic/speech'

interface Props {
  lesson: Lesson
  primaryLabel: string
  onPrimary: () => void
  onBack: () => void
  backLabel?: string
}

const speechAvailable = canSpeak()

function Section({ s }: { s: LessonSection }) {
  switch (s.type) {
    case 'text':
      return <p className="sec-text">{s.text}</p>
    case 'note':
      return <p className="sec-note">💡 {s.text}</p>
    case 'table':
      return (
        <div className="sec-table-wrap">
          <table className="sec-table">
            <thead>
              <tr>
                {s.header.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'examples':
      return (
        <ul className="sec-examples">
          {s.items.map((ex, i) => (
            <li key={i}>
              <span className="ex-el">
                {ex.el}
                {speechAvailable && (
                  <button className="ex-speak" onClick={() => speak(ex.el)} aria-label="Озвучить">
                    🔊
                  </button>
                )}
              </span>
              <span className="ex-ru">{ex.ru}</span>
            </li>
          ))}
        </ul>
      )
  }
}

export function LessonExplanation({ lesson, primaryLabel, onPrimary, onBack, backLabel = '← Уроки' }: Props) {
  return (
    <main className="explain">
      <div className="explain-top">
        <button className="link-btn" onClick={onBack}>
          {backLabel}
        </button>
        <span className="explain-num">Урок {lesson.id}</span>
      </div>
      <h1 className="explain-title">{lesson.title}</h1>
      {lesson.sections.map((s, i) => (
        <Section key={i} s={s} />
      ))}
      <button className="primary-btn explain-cta" onClick={onPrimary}>
        {primaryLabel}
      </button>
    </main>
  )
}
