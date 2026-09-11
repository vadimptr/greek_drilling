import { useCallback, useEffect, useRef, useState } from 'react'
import { WORDS } from '../data/words'
import { pickNext } from '../logic/pick'
import { canSpeak, speak } from '../logic/speech'
import { checkSpell, initialSpellState, makeSpellTask, type SpellState, type SpellTask } from '../logic/spell'
import { applyAnswer, isWin } from '../logic/state'
import { WinOverlay } from '../components/WinOverlay'

const CORRECT_DELAY_MS = 650
const speechAvailable = canSpeak()

const TASK_TEXT: Record<SpellTask['kind'], string> = {
  missing: 'Какая буква пропущена?',
  extra: 'Нажми на лишнюю букву',
  wrong: 'Нажми на неправильную букву',
}

interface Props {
  state: SpellState
  onChange: (next: SpellState) => void
}

interface Answer {
  index?: number
  option?: string
  correct: boolean
}

function nextTask(state: SpellState): SpellTask | null {
  const word = pickNext(state, WORDS)
  return word ? makeSpellTask(word) : null
}

/** Разбивает токены на слова, сохраняя исходные индексы, чтобы переносить по словам. */
function groupWords(tokens: string[]): number[][] {
  const groups: number[][] = [[]]
  tokens.forEach((t, i) => {
    if (t === ' ') groups.push([])
    else groups[groups.length - 1].push(i)
  })
  return groups.filter((g) => g.length > 0)
}

export function SpellScreen({ state, onChange }: Props) {
  const [task, setTask] = useState<SpellTask | null>(() => nextTask(state))
  const [answer, setAnswer] = useState<Answer | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  useEffect(() => {
    if (task === null && !isWin(state, WORDS)) setTask(nextTask(state))
  }, [state, task])

  const advance = useCallback((next: SpellState) => {
    setAnswer(null)
    setTask(nextTask(next))
  }, [])

  const submit = (a: { index?: number; option?: string }) => {
    if (!task || answer) return
    const correct = checkSpell(task, a)
    setAnswer({ ...a, correct })
    const next = applyAnswer(state, task.word.id, correct)
    onChange(next)
    if (correct) {
      timer.current = window.setTimeout(() => {
        timer.current = null
        advance(next)
      }, CORRECT_DELAY_MS)
    } else if (speechAvailable) {
      speak(task.word.el)
    }
  }

  const restart = () => {
    const next = initialSpellState()
    onChange(next)
    advance(next)
  }

  const won = isWin(state, WORDS)
  if (!task) return <main className="spell">{won && <WinOverlay total={WORDS.length} bestStreak={state.bestStreak} onRestart={restart} />}</main>

  const tappable = task.kind !== 'missing' && !answer
  const cardClass = answer ? (answer.correct ? 'spell-card spell-card-ok' : 'spell-card spell-card-bad') : 'spell-card'

  const tileClass = (i: number) => {
    const t = task.tokens[i]
    if (!/\p{L}/u.test(t) && t !== '') return 'tile tile-punct'
    const isAnswer = task.answerIndices.includes(i)
    if (task.kind === 'missing' && t === '') {
      return answer ? 'tile tile-ok' : 'tile tile-gap'
    }
    if (answer && task.kind !== 'missing') {
      if (isAnswer) return task.kind === 'extra' ? 'tile tile-bad' : 'tile tile-ok'
      if (answer.index === i) return 'tile tile-chosen'
    }
    return tappable ? 'tile tile-tap' : 'tile'
  }

  const tileText = (i: number) => {
    const t = task.tokens[i]
    if (task.kind === 'missing' && t === '') return answer ? task.correctLetter : '?'
    if (answer && task.kind === 'wrong' && task.answerIndices.includes(i)) {
      // показать и что было написано, и что должно быть
      return (
        <>
          <s className="tile-was">{t}</s>
          {task.correctLetter}
        </>
      )
    }
    return t
  }

  const wrongLetter = task.kind === 'wrong' ? task.tokens[task.answerIndices[0]] : ''
  const explain =
    task.kind === 'missing'
      ? `пропущена буква ${task.correctLetter}`
      : task.kind === 'extra'
        ? `лишняя буква ${task.correctLetter}`
        : `${wrongLetter} вместо ${task.correctLetter}`

  const groups = groupWords(task.tokens)
  // длинные слова (до 15 клеток с лишней буквой) должны влезать в ширину iPhone — клетки уже
  const longest = Math.max(...groups.map((g) => g.length))
  const sizeClass = longest >= 13 ? 'spell-words spell-words-xs' : longest >= 10 ? 'spell-words spell-words-s' : 'spell-words'

  return (
    <main className="spell">
      <div key={`${task.word.id}-${task.kind}-${answer ? (answer.correct ? 'ok' : 'bad') : ''}`} className={cardClass}>
        <div className="spell-ru">{task.word.ru}</div>
        <div className={sizeClass}>
          {groups.map((group, gi) => (
            <div key={gi} className="spell-word">
              {group.map((i) => (
                <button
                  key={i}
                  className={tileClass(i)}
                  disabled={!tappable || task.tokens[i] === ''}
                  onClick={() => tappable && submit({ index: i })}
                  aria-label={task.tokens[i] || 'пропуск'}
                >
                  {tileText(i)}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="spell-task">
          {!answer && TASK_TEXT[task.kind]}
          {answer && answer.correct && <span className="speak-ok">✓ Верно!</span>}
          {answer && !answer.correct && (
            <span className="spell-answer">
              <span className="speak-bad">✗ {explain}.</span> Правильно: <span className="spell-correct">{task.word.el}</span>
            </span>
          )}
        </div>
      </div>

      <div className="spell-bottom">
        {task.kind === 'missing' && !answer && (
          <div className="letter-options">
            {task.options!.map((o) => (
              <button key={o} className="option letter-option" onClick={() => submit({ option: o })}>
                {o}
              </button>
            ))}
          </div>
        )}
        {task.kind === 'missing' && answer && (
          <div className="letter-options">
            {task.options!.map((o) => (
              <button
                key={o}
                className={
                  o === task.correctLetter
                    ? 'option letter-option option-correct'
                    : o === answer.option
                      ? 'option letter-option option-wrong'
                      : 'option letter-option option-dim'
                }
                disabled
              >
                {o}
              </button>
            ))}
          </div>
        )}
        <div className="spell-row">
          {speechAvailable && (
            <button className="secondary-btn" onClick={() => speak(task.word.el)}>
              🔊 Послушать
            </button>
          )}
          {answer && !answer.correct && (
            <button className="primary-btn" onClick={() => advance(state)}>
              Дальше
            </button>
          )}
        </div>
      </div>

      {won && !answer && <WinOverlay total={WORDS.length} bestStreak={state.bestStreak} onRestart={restart} />}
    </main>
  )
}
