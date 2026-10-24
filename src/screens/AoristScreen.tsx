import { useCallback, useEffect, useRef, useState } from 'react'
import { AORIST_VERBS, PRONOUNS, type AoristVerb } from '../data/aorist'
import { AORIST_THEORY } from '../data/aorist/theory'
import { AORIST_WORDS, aoristVerb, makeAoristTask, paradigm, type AoristTask } from '../logic/aorist'
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

function nextTask(state: SpeakState): AoristTask | null {
  const word = pickNext(state, AORIST_WORDS)
  const verb = word ? aoristVerb(word.id) : undefined
  return verb ? makeAoristTask(verb) : null
}

const hasProgress = (s: SpeakState) => s.learned.length > 0 || Object.keys(s.weak).length > 0

export function AoristScreen({ state, onChange }: Props) {
  const [view, setView] = useState<View>(() => (hasProgress(state) ? 'train' : 'theory'))

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
      {AORIST_VERBS.map((v) => (
        <VerbRow
          key={v.id}
          verb={v}
          mark={v.id in state.weak ? 'weak' : learned.has(v.id) ? 'learned' : null}
          open={open === v.id}
          onToggle={() => setOpen(open === v.id ? null : v.id)}
        />
      ))}
    </main>
  )
}

function VerbRow({ verb, mark, open, onToggle }: { verb: AoristVerb; mark: 'weak' | 'learned' | null; open: boolean; onToggle: () => void }) {
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
    </div>
  )
}

function Trainer({ state, onChange }: Props) {
  const [task, setTask] = useState<AoristTask | null>(() => nextTask(state))
  const [picked, setPicked] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  useEffect(() => {
    if (task === null && !isWin(state, AORIST_WORDS)) setTask(nextTask(state))
  }, [state, task])

  const advance = useCallback((next: SpeakState) => {
    setPicked(null)
    setTask(nextTask(next))
  }, [])

  const choose = (o: string) => {
    if (!task || picked !== null) return
    setPicked(o)
    const correct = o === task.answer
    const next = applyAnswer(state, task.verb.id, correct)
    onChange(next)
    if (speechAvailable) speak(task.reveal.split(' — ')[0])
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

  const won = isWin(state, AORIST_WORDS)
  if (!task) return <main className="nouns">{won && <WinOverlay total={AORIST_WORDS.length} bestStreak={state.bestStreak} onRestart={restart} />}</main>

  const answered = picked !== null
  const correct = picked === task.answer
  const cardClass = !answered ? 'nouns-card' : correct ? 'nouns-card spell-card-ok' : 'nouns-card spell-card-bad'
  const isSentence = task.kind === 'sentence-person' || task.kind === 'sentence-verb'

  return (
    <main className="nouns">
      <div key={`${task.verb.id}-${task.kind}-${task.prompt}-${answered ? (correct ? 'ok' : 'bad') : ''}`} className={cardClass}>
        <div className={isSentence ? 'aorist-sentence' : 'nouns-form'}>{answered && isSentence ? task.reveal : task.prompt}</div>
        <div className="spell-ru">{task.hint}</div>
        <div className="spell-task">
          {answered && correct && <span className="speak-ok">✓ {task.reveal}</span>}
          {answered && !correct && (
            <span className="spell-answer">
              <span className="speak-bad">✗</span> Правильно: <span className="spell-correct">{task.answer}</span>
            </span>
          )}
        </div>
        {answered && !correct && (
          <div className="aorist-paradigm">
            {task.verb.present}: {paradigm(task.verb)}
          </div>
        )}
      </div>

      <div className="spell-bottom">
        <div className="options">
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

      {won && !answered && <WinOverlay total={AORIST_WORDS.length} bestStreak={state.bestStreak} onRestart={restart} />}
    </main>
  )
}
