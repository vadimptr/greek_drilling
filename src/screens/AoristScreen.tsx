import { useCallback, useEffect, useRef, useState } from 'react'
import { AORIST_GROUPS, PRONOUNS, PRONOUN_RU, type AoristVerb } from '../data/aorist'
import { AORIST_THEORY } from '../data/aorist/theory'
import { aoristVerb, aoristWords, fillBlank, makeAoristTask, paradigm, sentencesOf, verbsOf, type AoristTask, type GroupFilter } from '../logic/aorist'
import { pickNext } from '../logic/pick'
import { canSpeak, speak } from '../logic/speech'
import { initialSpeakState, type SpeakState } from '../logic/speakState'
import { applyAnswer, isWin } from '../logic/state'
import { Section } from '../components/grammar/LessonExplanation'
import { WinOverlay } from '../components/WinOverlay'

const CORRECT_DELAY_MS = 900
const speechAvailable = canSpeak()

type View = 'theory' | 'verbs' | 'train'

const VIEWS: { id: View; label: string }[] = [
  { id: 'theory', label: 'Теория' },
  { id: 'verbs', label: 'Глаголы' },
  { id: 'train', label: 'Тренировка' },
]

interface Props {
  state: SpeakState
  onChange: (next: SpeakState) => void
}

const GROUP_KEY = 'greek_drilling.aoristGroup'

const FILTERS: { id: GroupFilter; label: string }[] = [{ id: 'all', label: 'Все' }, ...AORIST_GROUPS.map((g) => ({ id: g.id, label: g.label }))]

function loadFilter(): GroupFilter {
  try {
    const v = localStorage.getItem(GROUP_KEY)
    return FILTERS.some((f) => f.id === v) ? (v as GroupFilter) : 'all'
  } catch {
    return 'all'
  }
}

function saveFilter(f: GroupFilter) {
  try {
    localStorage.setItem(GROUP_KEY, f)
  } catch {
    return
  }
}

const groupTitle = (g: AoristVerb['group']) => AORIST_GROUPS.find((x) => x.id === g)!.title
const groupLabel = (g: AoristVerb['group']) => AORIST_GROUPS.find((x) => x.id === g)!.label

function nextTask(state: SpeakState, filter: GroupFilter): AoristTask | null {
  const word = pickNext(state, aoristWords(filter))
  const verb = word ? aoristVerb(word.id) : undefined
  return verb ? makeAoristTask(verb) : null
}

const hasProgress = (s: SpeakState) => s.learned.length > 0 || Object.keys(s.weak).length > 0

export function AoristScreen({ state, onChange }: Props) {
  const [view, setView] = useState<View>(() => (hasProgress(state) ? 'train' : 'theory'))
  const [filter, setFilter] = useState<GroupFilter>(loadFilter)

  const changeFilter = (f: GroupFilter) => {
    setFilter(f)
    saveFilter(f)
  }

  useEffect(() => {
    document.querySelector('.screen')?.scrollTo({ top: 0 })
  }, [view])

  return (
    <div className="aorist">
      <div className="segmented seg-3 aorist-views">
        {VIEWS.map((v) => (
          <button key={v.id} className={v.id === view ? 'seg seg-active' : 'seg'} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {view === 'theory' && <Theory onTrain={() => setView('train')} />}
      {view !== 'theory' && <GroupPicker filter={filter} onChange={changeFilter} />}
      {view === 'verbs' && <VerbList state={state} filter={filter} />}
      {view === 'train' && <Trainer key={filter} state={state} onChange={onChange} filter={filter} />}
    </div>
  )
}

function Theory({ onTrain }: { onTrain: () => void }) {
  return (
    <main className="explain">
      <h1 className="explain-title">Аорист — прошедшее время</h1>
      {AORIST_THEORY.map((ch, i) => (
        <section key={i} className="aorist-chapter">
          <h2 className="aorist-chapter-title">
            {i + 1}. {ch.title}
          </h2>
          {ch.sections.map((s, j) => (
            <Section key={j} s={s} />
          ))}
        </section>
      ))}
      <button className="primary-btn explain-cta" onClick={onTrain}>
        К тренировке
      </button>
    </main>
  )
}

function GroupPicker({ filter, onChange }: { filter: GroupFilter; onChange: (f: GroupFilter) => void }) {
  return (
    <div className="aorist-groups">
      {FILTERS.map((f) => (
        <button key={f.id} className={f.id === filter ? 'aorist-group aorist-group-active' : 'aorist-group'} onClick={() => onChange(f.id)}>
          {f.label}
        </button>
      ))}
    </div>
  )
}

function VerbList({ state, filter }: { state: SpeakState; filter: GroupFilter }) {
  const [open, setOpen] = useState<number | null>(null)
  const learned = new Set(state.learned)
  const groups = AORIST_GROUPS.filter((g) => filter === 'all' || g.id === filter)
  return (
    <main className="aorist-verbs">
      <p className="sec-text">Нажми на глагол, чтобы увидеть все формы. ✓ — усвоен, ● — на повторении.</p>
      {groups.map((g) => {
        const verbs = verbsOf(g.id)
        return (
          <section key={g.id} className="aorist-verbs">
            <h2 className="aorist-chapter-title">
              {g.title} · {verbs.length}
            </h2>
            {verbs.map((v) => (
              <VerbRow
                key={v.id}
                verb={v}
                mark={v.id in state.weak ? 'weak' : learned.has(v.id) ? 'learned' : null}
                open={open === v.id}
                onToggle={() => setOpen(open === v.id ? null : v.id)}
              />
            ))}
          </section>
        )
      })}
    </main>
  )
}

function VerbRow({ verb, mark, open, onToggle }: { verb: AoristVerb; mark: 'weak' | 'learned' | null; open: boolean; onToggle: () => void }) {
  const sentences = open ? sentencesOf(verb.id) : []
  return (
    <div className={open ? 'verb-row verb-row-open' : 'verb-row'}>
      <button className="verb-row-head" onClick={onToggle} aria-expanded={open}>
        <span className="verb-row-mark">{mark === 'learned' ? '✓' : mark === 'weak' ? '●' : ''}</span>
        <span className="verb-row-main">
          <span className="verb-row-el">
            {verb.present} → <b>{verb.forms[0]}</b>
          </span>
          <span className="verb-row-ru">{verb.ru}</span>
        </span>
        <span className="sub-picker-caret">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <table className="sec-table verb-table">
          <tbody>
            {verb.forms.map((f, p) => (
              <tr key={p}>
                <td className="verb-pron">{PRONOUNS[p]}</td>
                <td className="verb-form">
                  {f}
                  {speechAvailable && (
                    <button className="ex-speak" onClick={() => speak(f)} aria-label="Озвучить">
                      🔊
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sentences.length > 0 && (
        <ul className="verb-examples">
          {sentences.map((s, i) => (
            <li key={i}>
              <span className="verb-example-el">{fillBlank(s, verb.forms[s.p])}</span>
              <span className="verb-row-ru">{s.ru}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Trainer({ state, onChange, filter }: Props & { filter: GroupFilter }) {
  const words = aoristWords(filter)
  const [task, setTask] = useState<AoristTask | null>(() => nextTask(state, filter))
  const [picked, setPicked] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  useEffect(() => {
    if (task === null && !isWin(state, words)) setTask(nextTask(state, filter))
  }, [state, task, words, filter])

  const advance = useCallback(
    (next: SpeakState) => {
      setPicked(null)
      setTask(nextTask(next, filter))
    },
    [filter],
  )

  const choose = (o: string) => {
    if (!task || picked !== null) return
    setPicked(o)
    const correct = o === task.answer
    const next = applyAnswer(state, task.verb.id, correct)
    onChange(next)
    if (speechAvailable) speak(task.form)
    if (correct) {
      timer.current = window.setTimeout(() => {
        timer.current = null
        advance(next)
      }, CORRECT_DELAY_MS)
    }
  }

  const restart = () => {
    const next = initialSpeakState()
    onChange(next)
    advance(next)
  }

  const won = isWin(state, words)
  if (!task) return <main className="nouns">{won && <WinOverlay total={words.length} bestStreak={state.bestStreak} onRestart={restart} />}</main>

  const answered = picked !== null
  const correct = picked === task.answer
  const cardClass = !answered ? 'nouns-card' : correct ? 'nouns-card spell-card-ok' : 'nouns-card spell-card-bad'

  return (
    <main className="nouns">
      <div key={`${task.verb.id}-${task.person}-${answered ? (correct ? 'ok' : 'bad') : ''}`} className={cardClass}>
        <div className="aorist-meta">
          <span className="aorist-badge">{groupLabel(task.verb.group)}</span>
          <span>
            {PRONOUNS[task.person]} · {PRONOUN_RU[task.person]}
          </span>
        </div>
        <div className="nouns-form">{task.form}</div>
        <div className="spell-ru">{answered ? `${task.verb.present} — ${task.verb.ru}` : 'Как переводится глагол?'}</div>
        {answered && (
          <div className="aorist-paradigm">
            {groupTitle(task.verb.group)}
            <br />
            {paradigm(task.verb)}
          </div>
        )}
      </div>

      <div className="spell-bottom">
        <div className="options options-6">
          {task.options.map((o) => (
            <button
              key={o}
              className={
                !answered ? 'option' : o === task.answer ? 'option option-correct' : o === picked ? 'option option-wrong' : 'option option-dim'
              }
              disabled={answered}
              onClick={() => choose(o)}
            >
              {o}
            </button>
          ))}
        </div>
        {answered && !correct && (
          <div className="spell-row">
            <button className="primary-btn" onClick={() => advance(state)}>
              Дальше
            </button>
          </div>
        )}
      </div>

      {won && !answered && <WinOverlay total={words.length} bestStreak={state.bestStreak} onRestart={restart} />}
    </main>
  )
}
