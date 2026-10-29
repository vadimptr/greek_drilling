import type { NotePerson } from '../../logic/city/api'
import type { Lang } from '../../logic/city/name'
import { attitudeWord, translate, useT, useUi } from '../../logic/i18n'
import { Leaderboard } from './Leaderboard'
import { Tip } from './Tip'

interface Props {
  city: string
  people: NotePerson[]
  score: number
  fresh: Set<string>
  current: string | null
  canPick: boolean
  onPick: (id: string) => void
}

const ICON: Record<NotePerson['mood'], string> = { friendly: '🙂', annoyed: '😒', offended: '😤', angry: '😠' }

export function attitude(p: NotePerson, ui: Lang = 'ru'): string {
  if (!p.met) return translate(ui, 'notebook.strangers')
  return `${ICON[p.mood]} ${attitudeWord(ui, p.mood, p.gender)}`
}

export function reasonOf(p: NotePerson, ui: Lang = 'ru'): string {
  if (!p.met) return translate(ui, 'notebook.notMet')
  if (p.moodReason) return p.moodReason
  return translate(ui, p.mood === 'friendly' ? 'notebook.normal' : 'notebook.noReason')
}

export function Notebook({ city, people, score, fresh, current, canPick, onPick }: Props) {
  const t = useT()
  const ui = useUi()
  return (
    <aside className="notebook" aria-label={t('notebook.aria')}>
      <div className="notebook-head">
        <span className="notebook-title">{t('notebook.title')}</span>
        <Leaderboard city={city}>
          <span className="notebook-score">{t('notebook.points', { n: score })}</span>
        </Leaderboard>
      </div>
      <div className="notebook-tip">{t('notebook.tip')}</div>
      {people.map((p) => (
        <section key={p.id} className="notebook-person">
          <button
            className={p.id === current ? 'notebook-name notebook-name-current' : 'notebook-name'}
            onClick={() => onPick(p.id)}
            disabled={!canPick || p.id === current}
          >
            <span>
              {p.id === current && '🗣️ '}
              {p.name} {p.nameHint !== p.name && <span className="notebook-name-ru">{p.nameHint}</span>}
            </span>
            <Tip text={reasonOf(p, ui)} align="right" className={`notebook-mood notebook-mood-${p.met ? p.mood : 'stranger'}`}>
              {attitude(p, ui)}
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
          {p.hidden > 0 && <div className="notebook-hidden">{t('notebook.hidden', { n: p.hidden })}</div>}
        </section>
      ))}
    </aside>
  )
}
