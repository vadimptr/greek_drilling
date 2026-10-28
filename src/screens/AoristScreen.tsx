import { useCallback, useEffect, useRef, useState } from 'react'
import { AORIST_GROUPS, PRONOUNS, PRONOUN_RU, type AoristGroup, type AoristVerb } from '../data/aorist'
import { AORIST_THEORY } from '../data/aorist/theory'
import { aoristVerb, aoristWords, fillBlank, makeAoristTask, paradigm, personsOf, sentencesOf, verbsOf, type AoristTask, type GroupFilter } from '../logic/aorist'
import { pickNext } from '../logic/pick'
import { canSpeak, speak } from '../logic/speech'
import { initialSpeakState, type SpeakState } from '../logic/speakState'
import { applyAnswer, isWin } from '../logic/state'
import { Section } from '../components/grammar/LessonExplanation'
import { WinOverlay } from '../components/WinOverlay'

const CORRECT_DELAY_MS = 1400
const STEP_DELAY_MS = 500
const WRONG_STEP_DELAY_MS = 1200
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

type Step = 'ru' | 'group' | 'person'

const STEPS: { id: Step; label: string; question: string }[] = [
  { id: 'ru', label: 'Перевод', question: 'Как переводится глагол?' },
  { id: 'group', label: 'Группа', question: 'К какой группе относится?' },
  { id: 'person', label: 'Лицо', question: 'Какое лицо и число?' },
]

interface Picks {
  ru?: string
  group?: AoristGroup
  person?: number
}

interface StepOption {
  key: string
  label: string
  right: boolean
  pick: Picks
}

function stepOptions(step: Step, task: AoristTask): StepOption[] {
  if (step === 'ru') return task.options.map((o) => ({ key: o, label: o, right: o === task.answer, pick: { ru: o } }))
  if (step === 'group')
    return AORIST_GROUPS.map((g) => ({ key: g.id, label: g.title, right: g.id === task.verb.group, pick: { group: g.id } }))
  const persons = personsOf(task.verb, task.form)
  return PRONOUNS.map((p, i) => ({ key: p, label: `${p} · ${PRONOUN_RU[i]}`, right: persons.includes(i), pick: { person: i } }))
}

function isPicked(o: StepOption, picks: Picks): boolean {
  return (
    (o.pick.ru !== undefined && o.pick.ru === picks.ru) ||
    (o.pick.group !== undefined && o.pick.group === picks.group) ||
    (o.pick.person !== undefined && o.pick.person === picks.person)
  )
}

function Trainer({ state, onChange, filter }: Props & { filter: GroupFilter }) {
  const words = aoristWords(filter)
  const [task, setTask] = useState<AoristTask | null>(() => nextTask(state, filter))
  const [picks, setPicks] = useState<Picks>({})
  const [stepIndex, setStepIndex] = useState(0)
  const timer = useRef<number | null>(null)

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => clearTimer, [])

  useEffect(() => {
    if (task === null && !isWin(state, words)) setTask(nextTask(state, filter))
  }, [state, task, words, filter])

  const advance = useCallback(
    (next: SpeakState) => {
      clearTimer()
      setPicks({})
      setStepIndex(0)
      setTask(nextTask(next, filter))
    },
    [filter],
  )

  const restart = () => {
    const next = initialSpeakState()
    onChange(next)
    advance(next)
  }

  const won = isWin(state, words)
  if (!task) return <main className="nouns">{won && <WinOverlay total={words.length} bestStreak={state.bestStreak} onRestart={restart} />}</main>

  const results = {
    ru: picks.ru === undefined ? undefined : picks.ru === task.answer,
    group: picks.group === undefined ? undefined : picks.group === task.verb.group,
    person: picks.person === undefined ? undefined : personsOf(task.verb, task.form).includes(picks.person),
  }
  const done = stepIndex >= STEPS.length
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)]
  const stepPicked = results[step.id] !== undefined
  const allRight = done && results.ru && results.group && results.person
  const options = stepOptions(step.id, task)

  const choose = (o: StepOption) => {
    if (stepPicked) return
    const nextPicks = { ...picks, ...o.pick }
    setPicks(nextPicks)
    const last = stepIndex === STEPS.length - 1
    if (!last) {
      timer.current = window.setTimeout(() => {
        timer.current = null
        setStepIndex((i) => i + 1)
      }, o.right ? STEP_DELAY_MS : WRONG_STEP_DELAY_MS)
      return
    }
    const correct = nextPicks.ru === task.answer && nextPicks.group === task.verb.group && o.right
    const next = applyAnswer(state, task.verb.id, correct)
    onChange(next)
    setStepIndex(STEPS.length)
    if (speechAvailable) speak(task.form)
    if (correct) {
      timer.current = window.setTimeout(() => {
        timer.current = null
        advance(next)
      }, CORRECT_DELAY_MS)
    }
  }

  const cardClass = !done ? 'nouns-card' : allRight ? 'nouns-card spell-card-ok' : 'nouns-card spell-card-bad'
  const summary: { label: string; ok: boolean | undefined; value: string }[] = [
    { label: 'Перевод', ok: results.ru, value: `${task.verb.present} — ${task.verb.ru}` },
    { label: 'Группа', ok: results.group, value: groupTitle(task.verb.group) },
    { label: 'Лицо', ok: results.person, value: `${PRONOUNS[task.person]} · ${PRONOUN_RU[task.person]}` },
  ]

  return (
    <main className="nouns">
      <div key={`${task.verb.id}-${task.person}-${done ? (allRight ? 'ok' : 'bad') : ''}`} className={cardClass}>
        <div className="aorist-steps">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={
                results[s.id] === true
                  ? 'aorist-step aorist-step-ok'
                  : results[s.id] === false
                    ? 'aorist-step aorist-step-bad'
                    : i === stepIndex
                      ? 'aorist-step aorist-step-active'
                      : 'aorist-step'
              }
            >
              {s.label}
            </span>
          ))}
        </div>
        <div className="nouns-form">{task.form}</div>
        {!done && <div className="spell-ru">{step.question}</div>}
        {summary.some((r) => r.ok !== undefined) && (
          <ul className="aorist-summary">
            {summary
              .filter((r) => r.ok !== undefined)
              .map((r) => (
                <li key={r.label} className={r.ok ? 'aorist-summary-ok' : 'aorist-summary-bad'}>
                  <span className="aorist-summary-mark">{r.ok ? '✓' : '✗'}</span>
                  {r.value}
                </li>
              ))}
          </ul>
        )}
        {done && <div className="aorist-paradigm">{paradigm(task.verb)}</div>}
      </div>

      <div className="spell-bottom">
        {!done && (
          <div className={step.id === 'group' ? 'options options-groups' : 'options options-6'}>
            {options.map((o) => (
              <button
                key={o.key}
                className={
                  !stepPicked ? 'option' : o.right ? 'option option-correct' : isPicked(o, picks) ? 'option option-wrong' : 'option option-dim'
                }
                disabled={stepPicked}
                onClick={() => choose(o)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {done && !allRight && (
          <div className="spell-row">
            <button className="primary-btn" onClick={() => advance(state)}>
              Дальше
            </button>
          </div>
        )}
      </div>

      {won && !done && stepIndex === 0 && !stepPicked && <WinOverlay total={words.length} bestStreak={state.bestStreak} onRestart={restart} />}
    </main>
  )
}
