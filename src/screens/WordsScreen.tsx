import { useCallback, useEffect, useRef, useState } from 'react'
import { WORDS } from '../data/words'
import { buildOptions } from '../logic/options'
import { pickNext } from '../logic/pick'
import { canSpeak, speak } from '../logic/speech'
import { applyAnswer, isWin, restart, type RoundState } from '../logic/state'
import type { Word } from '../types/word'
import { Prompt } from '../components/Prompt'
import { Options, type Feedback } from '../components/Options'
import { WinOverlay } from '../components/WinOverlay'
import { WordInfoPopup } from '../components/WordInfoPopup'

const CORRECT_DELAY_MS = 500
const WRONG_DELAY_MS = 1100

interface Question {
  word: Word
  options: Word[]
}

function makeQuestion(state: RoundState): Question | null {
  const word = pickNext(state, WORDS)
  if (!word) return null
  return { word, options: buildOptions(word, WORDS, state.direction) }
}

const speechAvailable = canSpeak()

interface Props {
  state: RoundState
  onChange: (next: RoundState) => void
}

export function WordsScreen({ state, onChange }: Props) {
  const [question, setQuestion] = useState<Question | null>(() => makeQuestion(state))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const timer = useRef<number | null>(null)
  const interacted = useRef(false)
  const lastDirection = useRef(state.direction)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  // смена направления в настройках: пересобрать варианты для текущего слова
  useEffect(() => {
    if (lastDirection.current === state.direction) return
    lastDirection.current = state.direction
    setQuestion((q) => (q ? { word: q.word, options: buildOptions(q.word, WORDS, state.direction) } : q))
  }, [state.direction])

  // сброс прогресса извне: если слово выучено/нет вопроса — переподобрать
  useEffect(() => {
    if (question === null && !isWin(state, WORDS)) setQuestion(makeQuestion(state))
  }, [state, question])

  // автоозвучка нового греческого слова (после первого взаимодействия — iOS требует жест)
  useEffect(() => {
    if (!question || !state.autoSpeak || state.direction !== 'el-ru' || !interacted.current) return
    speak(question.word.el)
  }, [question, state.autoSpeak, state.direction])

  const answer = useCallback(
    (option: Word) => {
      if (!question || feedback) return
      interacted.current = true
      const correct = option.id === question.word.id
      const next = applyAnswer(state, question.word.id, correct)
      setFeedback({ chosenId: option.id, correct })
      onChange(next)
      if (next.autoSpeak && next.direction === 'ru-el') speak(question.word.el)
      timer.current = window.setTimeout(() => {
        timer.current = null
        setFeedback(null)
        setInfoOpen(false)
        setQuestion(makeQuestion(next))
      }, correct ? CORRECT_DELAY_MS : WRONG_DELAY_MS)
    },
    [question, feedback, state, onChange],
  )

  const restartRound = () => {
    const next = restart(state)
    onChange(next)
    setFeedback(null)
    setInfoOpen(false)
    setQuestion(makeQuestion(next))
  }

  const speakCurrent = () => {
    interacted.current = true
    if (question) speak(question.word.el)
  }

  const won = isWin(state, WORDS)

  return (
    <>
      {question && (
        <Prompt
          word={question.word}
          direction={state.direction}
          canSpeak={speechAvailable}
          onTapWord={() => {
            interacted.current = true
            setInfoOpen(true)
          }}
          onSpeak={speakCurrent}
        />
      )}

      {question && (
        <Options
          options={question.options}
          targetId={question.word.id}
          direction={state.direction}
          feedback={feedback}
          onSelect={answer}
        />
      )}

      <WordInfoPopup word={infoOpen && question ? question.word : null} onClose={() => setInfoOpen(false)} />

      {won && !feedback && <WinOverlay total={WORDS.length} bestStreak={state.bestStreak} onRestart={restartRound} />}
    </>
  )
}
