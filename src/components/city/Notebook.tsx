import type { NotePerson } from '../../logic/city/api'

interface Props {
  people: NotePerson[]
  score: number
  fresh: Set<string>
}

export function Notebook({ people, score, fresh }: Props) {
  return (
    <aside className="notebook" aria-label="Блокнот">
      <div className="notebook-head">
        <span className="notebook-title">📓 Блокнот</span>
        <span className="notebook-score">{score} очк.</span>
      </div>
      {people.map((p) => (
        <section key={p.id} className="notebook-person">
          <div className="notebook-name">
            {p.name} <span className="notebook-name-ru">{p.nameRu}</span>
          </div>
          <ul className="notebook-facts">
            {p.facts.map((f) => (
              <li key={f.id} className={fresh.has(f.id) ? 'notebook-fact notebook-fact-fresh' : 'notebook-fact'}>
                <span className="notebook-fact-text">
                  {f.goal && '🎯 '}
                  {f.text}
                </span>
                {f.points > 0 && <span className="notebook-points">+{f.points}</span>}
              </li>
            ))}
          </ul>
          {p.hidden > 0 && <div className="notebook-hidden">ещё не узнано: {p.hidden}</div>}
        </section>
      ))}
    </aside>
  )
}
