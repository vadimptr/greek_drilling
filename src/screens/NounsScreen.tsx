import { useCallback, useEffect, useRef, useState } from 'react'
import { NOUNS, type NounEntry } from '../data/nouns'
import { WORDS } from '../data/words'
import {
  CASE_LABEL,
  CASE_SHORT,
  CASES,
  checkIdentify,
  describeAnalyses,
  GENDER_SHORT,
  GENDERS,
  genderOf,
  makeNounTask,
  NUM_LABEL,
  NUM_SHORT,
  NUMS,
  withArticle,
  type Case,
  type Gender,
  type NounTask,
  type Num,
} from '../logic/nouns'
import { pickNext } from '../logic/pick'
import { canSpeak, speak } from '../logic/speech'
import { initialSpeakState, type SpeakState } from '../logic/speakState'
import { applyAnswer, isWin } from '../logic/state'
import type { Word } from '../types/word'
import { WinOverlay } from '../components/WinOverlay'

const CORRECT_DELAY_MS = 800
const speechAvailable = canSpeak()

/** Слова словаря, для которых есть таблица склонения (в порядке NOUNS). */
const byEl = new Map(WORDS.map((w) => [w.el, w]))
const NOUN_WORDS: Word[] = NOUNS.map((e) => byEl.get(e.el)).filter((w): w is Word => !!w)
const entryByWordId = new Map<number, NounEntry>(NOUNS.map((e) => [byEl.get(e.el)!.id, e]))

interface Props {
  state: SpeakState
  onChange: (next: SpeakState) => void
}

interface Current {
  word: Word
  task: NounTask
}

function nextCurrent(state: SpeakState): Current | null {
  const word = pickNext(state, NOUN_WORDS)
  const entry = word ? entryByWordId.get(word.id) : undefined
  return word && entry ? { word, task: makeNounTask(entry) } : null
}

interface Choice {
  g: Gender | null
  c: Case | null
  n: Num | null
}

export function NounsScreen({ state, onChange }: Props) {
  const [cur, setCur] = useState<Current | null>(() => nextCurrent(state))
  const [choice, setChoice] = useState<Choice>({ g: null, c: null, n: null })
  const [picked, setPicked] = useState<string | null>(null)
  const [result, setResult] = useState<boolean | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  useEffect(() => {
    if (cur === null && !isWin(state, NOUN_WORDS)) setCur(nextCurrent(state))
  }, [state, cur])

  const advance = useCallback((next: SpeakState) => {
    setResult(null)
    setPicked(null)
    setChoice({ g: null, c: null, n: null })
    setCur(nextCurrent(next))
  }, [])

  const finish = (correct: boolean) => {
    if (!cur) return
    setResult(correct)
    const next = applyAnswer(state, cur.word.id, correct)
    onChange(next)
    if (correct) {
      timer.current = window.setTimeout(() => {
        timer.current = null
        advance(next)
      }, CORRECT_DELAY_MS)
    } else if (speechAvailable) {
      speak(cur.task.kind === 'identify' ? cur.task.shown : withArticle(cur.task.entry, cur.task.target.c, cur.task.target.n))
    }
  }

  const checkIdentifyChoice = () => {
    if (!cur || cur.task.kind !== 'identify' || result !== null) return
    if (!choice.g || !choice.c || !choice.n) return
    finish(checkIdentify(cur.task, { g: choice.g, c: choice.c, n: choice.n }))
  }

  const pickOption = (o: string) => {
    if (!cur || cur.task.kind !== 'transform' || result !== null) return
    setPicked(o)
    finish(o === cur.task.answer)
  }

  const restart = () => {
    const next = initialSpeakState()
    onChange(next)
    advance(next)
  }

  const won = isWin(state, NOUN_WORDS)
  if (!cur) return <main className="nouns">{won && <WinOverlay total={NOUN_WORDS.length} bestStreak={state.bestStreak} onRestart={restart} />}</main>

  const { task, word } = cur
  const gender = genderOf(task.entry)
  const cardClass = result === null ? 'nouns-card' : result ? 'nouns-card spell-card-ok' : 'nouns-card spell-card-bad'
  const answered = result !== null

  const segClass = <T extends string>(value: T, chosen: T | null, correct: (v: T) => boolean) => {
    if (!answered) return value === chosen ? 'seg seg-active' : 'seg'
    if (correct(value)) return 'seg seg-ok'
    if (value === chosen) return 'seg seg-bad'
    return 'seg'
  }

  return (
    <main className="nouns">
      <div key={`${word.id}-${task.kind}-${result === null ? '' : result ? 'ok' : 'bad'}`} className={cardClass}>
        <div className="spell-ru">{word.ru}</div>
        {task.kind === 'identify' ? (
          <>
            <div className="nouns-form">{task.shown}</div>
            <div className="spell-task">
              {!answered && 'В какой форме стоит слово?'}
              {answered && result && <span className="speak-ok">✓ Верно: {describeAnalyses(task.entry, task.valid)}</span>}
              {answered && !result && (
                <span className="spell-answer">
                  <span className="speak-bad">✗</span> Это {describeAnalyses(task.entry, task.valid)}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="nouns-form">{task.source}</div>
            <div className="nouns-arrow">
              → {CASE_LABEL[task.target.c]} падеж, {NUM_LABEL[task.target.n]} число
            </div>
            <div className="spell-task">
              {!answered && 'Выбери нужную форму'}
              {answered && result && <span className="speak-ok">✓ Верно: {withArticle(task.entry, task.target.c, task.target.n)}</span>}
              {answered && !result && (
                <span className="spell-answer">
                  <span className="speak-bad">✗</span> Правильно:{' '}
                  <span className="spell-correct">{withArticle(task.entry, task.target.c, task.target.n)}</span>
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="spell-bottom">
        {task.kind === 'identify' && (
          <>
            <div className="nouns-row">
              <div className="nouns-row-label">Род</div>
              <div className="segmented seg-3">
                {GENDERS.map((g) => (
                  <button key={g} className={segClass(g, choice.g, (v) => v === gender)} disabled={answered} onClick={() => setChoice({ ...choice, g })}>
                    {GENDER_SHORT[g]}
                  </button>
                ))}
              </div>
            </div>
            <div className="nouns-row">
              <div className="nouns-row-label">Падеж</div>
              <div className="segmented seg-3">
                {CASES.map((c) => (
                  <button
                    key={c}
                    className={segClass(c, choice.c, (v) => task.valid.some((a) => a.c === v && (choice.n === null || a.n === choice.n)))}
                    disabled={answered}
                    onClick={() => setChoice({ ...choice, c })}
                  >
                    {CASE_SHORT[c]}
                  </button>
                ))}
              </div>
            </div>
            <div className="nouns-row">
              <div className="nouns-row-label">Число</div>
              <div className="segmented">
                {NUMS.map((n) => (
                  <button
                    key={n}
                    className={segClass(n, choice.n, (v) => task.valid.some((a) => a.n === v && (choice.c === null || a.c === choice.c || !task.valid.some((b) => b.c === choice.c))))}
                    disabled={answered}
                    onClick={() => setChoice({ ...choice, n })}
                  >
                    {NUM_SHORT[n]}
                  </button>
                ))}
              </div>
            </div>
            {!answered && (
              <button className="primary-btn" disabled={!choice.g || !choice.c || !choice.n} onClick={checkIdentifyChoice}>
                Проверить
              </button>
            )}
          </>
        )}

        {task.kind === 'transform' && (
          <div className="options">
            {task.options.map((o) => (
              <button
                key={o}
                className={
                  !answered
                    ? 'option'
                    : o === task.answer
                      ? 'option option-correct'
                      : o === picked
                        ? 'option option-wrong'
                        : 'option option-dim'
                }
                disabled={answered}
                onClick={() => pickOption(o)}
              >
                {o}
              </button>
            ))}
          </div>
        )}

        <div className="spell-row">
          {speechAvailable && (
            <button className="secondary-btn" onClick={() => speak(task.kind === 'identify' ? task.shown : task.source)}>
              🔊 Послушать
            </button>
          )}
          {answered && !result && (
            <button className="primary-btn" onClick={() => advance(state)}>
              Дальше
            </button>
          )}
        </div>
      </div>

      {won && result === null && <WinOverlay total={NOUN_WORDS.length} bestStreak={state.bestStreak} onRestart={restart} />}
    </main>
  )
}
