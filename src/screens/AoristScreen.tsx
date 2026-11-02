import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AORIST_GROUPS, PRONOUNS, PRONOUN_RU, type AoristGroup, type AoristVerb } from '../data/aorist'
import { AORIST_THEORY } from '../data/aorist/theory'
import { aoristVerb, aoristWords, fillBlank, makeAoristTask, paradigm, personsOf, sentencesOf, verbsOf, type AoristTask } from '../logic/aorist'
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

const groupTitle = (g: AoristVerb['group']) => AORIST_GROUPS.find((x) => x.id === g)!.title

function nextTask(state: SpeakState): AoristTask | null {
  const word = pickNext(state, aoristWords('all'))
  const verb = word ? aoristVerb(word.id) : undefined
  return verb ? makeAoristTask(verb) : null
}

const hasProgress = (s: SpeakState) => s.learned.length > 0 || Object.keys(s.weak).length > 0

export function AoristScreen({ state, onChange, toolbar }: Props & { toolbar?: HTMLElement | null }) {
  const [view, setView] = useState<View>(() => (hasProgress(state) ? 'train' : 'theory'))
  useEffect(() => {
    document.querySelector('.screen')?.scrollTo({ top: 0 })
  }, [view])

  const views = (
    <div className="segmented seg-3 aorist-views">
      {VIEWS.map((v) => (
        <button key={v.id} className={v.id === view ? 'seg seg-active' : 'seg'} onClick={() => setView(v.id)}>
          {v.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="aorist">
      {toolbar ? createPortal(views, toolbar) : views}
      {view === 'theory' && <Theory onTrain={() => setView('train')} />}
      {view === 'verbs' && <VerbList state={state} />}
      {view === 'train' && <Trainer state={state} onChange={onChange} />}
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

function VerbList({ state }: { state: SpeakState }) {
  const [open, setOpen] = useState<number | null>(null)
  const learned = new Set(state.learned)
  return (
    <main className="aorist-verbs">
      <p className="sec-text">Нажми на глагол, чтобы увидеть все формы. ✓ — усвоен, ● — на повторении.</p>
      {AORIST_GROUPS.map((g) => {
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
    return AORIST_GROUPS.map((g) => ({ key: g.id, label: g.title.split(' — ')[0], right: g.id === task.verb.group, pick: { group: g.id } }))
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

function Trainer({ state, onChange }: Props) {
  const words = useMemo(() => aoristWords('all'), [])
  const [task, setTask] = useState<AoristTask | null>(() => nextTask(state))
  const [picks, setPicks] = useState<Picks>({})
  const [stepIndex, setStepIndex] = useState(0)
  const timer = useRef<number | null>(null)
  const keyChoose = useRef<((o: StepOption) => void) | null>(null)

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => clearTimer, [])

  useEffect(() => {
    if (task === null && !isWin(state, words)) setTask(nextTask(state))
  }, [state, task, words])

  const advance = useCallback(
    (next: SpeakState) => {
      clearTimer()
      setPicks({})
      setStepIndex(0)
      setTask(nextTask(next))
    },
    [],
  )

  const restart = () => {
    const next = initialSpeakState()
    onChange(next)
    advance(next)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!task || e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLInputElement) return
      if (stepIndex >= STEPS.length) {
        if (e.key === 'Enter') advance(state)
        return
      }
      const n = Number(e.key)
      const list = stepOptions(STEPS[stepIndex].id, task)
      if (Number.isInteger(n) && n >= 1 && n <= list.length) keyChoose.current?.(list[n - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [task, stepIndex, state, advance])

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

  keyChoose.current = choose
  const summary: { label: string; ok: boolean | undefined; value: string }[] = [
    { label: 'Перевод', ok: results.ru, value: done ? `${task.verb.present} — ${task.verb.ru}` : task.verb.ru },
    { label: 'Группа', ok: results.group, value: done ? groupTitle(task.verb.group) : groupTitle(task.verb.group).split(' — ')[0] },
    { label: 'Лицо', ok: results.person, value: `${PRONOUNS[task.person]} · ${PRONOUN_RU[task.person]}` },
  ]

  return (
    <main className="nouns trainer">
      <div className="trainer-card">
        <ol className="stepper">
          {STEPS.map((s, i) => {
            const r = results[s.id]
            const cls = r === true ? 'stepper-item stepper-ok' : r === false ? 'stepper-item stepper-bad' : i === stepIndex ? 'stepper-item stepper-active' : 'stepper-item'
            return (
              <li key={s.id} className={cls}>
                <span className="stepper-dot">{r === true ? '✓' : r === false ? '✗' : i + 1}</span>
                <span className="stepper-label">{s.label}</span>
              </li>
            )
          })}
        </ol>

        <div key={`${task.verb.id}-${task.person}-${done ? (allRight ? 'ok' : 'bad') : ''}`} className={done ? (allRight ? 'trainer-prompt trainer-prompt-ok' : 'trainer-prompt trainer-prompt-bad') : 'trainer-prompt'}>
          <button className="trainer-word" onClick={() => speechAvailable && speak(task.form)} disabled={!speechAvailable} title={speechAvailable ? 'Послушать' : undefined}>
            {task.form}
          </button>
          {!done && <div className="trainer-question">{step.question}</div>}
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

        <div className="trainer-answers">
          {!done && (
            <div className={step.id === 'group' ? 'options options-groups' : 'options options-6'}>
              {options.map((o, i) => (
                <button
                  key={o.key}
                  className={
                    !stepPicked ? 'option' : o.right ? 'option option-correct' : isPicked(o, picks) ? 'option option-wrong' : 'option option-dim'
                  }
                  disabled={stepPicked}
                  onClick={() => choose(o)}
                >
                  <span className="option-key">{i + 1}</span>
                  <span className="option-text">{o.label}</span>
                </button>
              ))}
            </div>
          )}
          {done && !allRight && (
            <button className="primary-btn trainer-next" onClick={() => advance(state)}>
              Дальше <span className="option-key option-key-light">Enter</span>
            </button>
          )}
        </div>
      </div>

      {won && !done && stepIndex === 0 && !stepPicked && <WinOverlay total={words.length} bestStreak={state.bestStreak} onRestart={restart} />}
    </main>
  )
}
