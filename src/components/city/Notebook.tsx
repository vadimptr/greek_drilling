import type { Mood, NotePerson } from '../../logic/city/api'
import { Tip } from './Tip'

interface Props {
  people: NotePerson[]
  score: number
  fresh: Set<string>
  current: string | null
  canPick: boolean
  onPick: (id: string) => void
}

const ATTITUDE: Record<Mood, { male: string; female: string; icon: string }> = {
  friendly: { male: 'дружелюбен', female: 'дружелюбна', icon: '🙂' },
  annoyed: { male: 'раздражён', female: 'раздражена', icon: '😒' },
  offended: { male: 'обижен', female: 'обижена', icon: '😤' },
  angry: { male: 'зол на тебя', female: 'зла на тебя', icon: '😠' },
}

export function attitude(p: NotePerson): string {
  if (!p.met) return 'не знакомы'
  const a = ATTITUDE[p.mood]
  return `${a.icon} ${a[p.gender]}`
}

export function reasonOf(p: NotePerson): string {
  if (!p.met) return 'Вы ещё не разговаривали'
  if (p.moodReason) return p.moodReason
  return p.mood === 'friendly' ? 'Ты ничем не задел — обычное отношение' : 'Причина не названа'
}

export function Notebook({ people, score, fresh, current, canPick, onPick }: Props) {
  return (
    <aside className="notebook" aria-label="Блокнот">
      <div className="notebook-head">
        <span className="notebook-title">📓 Блокнот</span>
        <span className="notebook-score">{score} очк.</span>
      </div>
      <div className="notebook-tip">Нажми на имя, чтобы подойти к человеку</div>
      {people.map((p) => (
        <section key={p.id} className="notebook-person">
          <button
            className={p.id === current ? 'notebook-name notebook-name-current' : 'notebook-name'}
            onClick={() => onPick(p.id)}
            disabled={!canPick || p.id === current}
          >
            <span>
              {p.id === current && '🗣️ '}
              {p.name} <span className="notebook-name-ru">{p.nameRu}</span>
            </span>
            <Tip text={reasonOf(p)} align="right" className={`notebook-mood notebook-mood-${p.met ? p.mood : 'stranger'}`}>
              {attitude(p)}
            </Tip>
          </button>
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
