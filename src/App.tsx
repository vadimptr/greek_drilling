import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { WORDS } from './data/words'
import { buildOptions } from './logic/options'
import { pickNext } from './logic/pick'
import { applyAnswer, isWin, restart, type RoundState } from './logic/state'
import { loadState, saveState } from './logic/storage'
import type { Direction, Word } from './types/word'
import { Header } from './components/Header'
import { Prompt } from './components/Prompt'
import { Options, type Feedback } from './components/Options'
import { SettingsSheet } from './components/SettingsSheet'
import { WinOverlay } from './components/WinOverlay'

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

export default function App() {
  const [state, setState] = useState<RoundState>(() => loadState(localStorage, WORDS))
  const [question, setQuestion] = useState<Question | null>(() => makeQuestion(state))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    saveState(localStorage, state)
  }, [state])

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const answer = useCallback(
    (option: Word) => {
      if (!question || feedback) return
      const correct = option.id === question.word.id
      const next = applyAnswer(state, question.word.id, correct)
      setFeedback({ chosenId: option.id, correct })
      setState(next)
      timer.current = window.setTimeout(() => {
        timer.current = null
        setFeedback(null)
        setQuestion(makeQuestion(next))
      }, correct ? CORRECT_DELAY_MS : WRONG_DELAY_MS)
    },
    [question, feedback, state],
  )

  const changeDirection = (direction: Direction) => {
    const next = { ...state, direction }
    setState(next)
    setQuestion((q) => (q ? { word: q.word, options: buildOptions(q.word, WORDS, direction) } : q))
  }

  const resetAll = () => {
    const next = restart(state)
    setState(next)
    setFeedback(null)
    setQuestion(makeQuestion(next))
    setSettingsOpen(false)
  }

  const won = isWin(state, WORDS)
  const weakCount = Object.keys(state.weak).length

  return (
    <div className="app">
      <Header
        score={state.score}
        bestStreak={state.bestStreak}
        learnedCount={state.learned.length}
        weakCount={weakCount}
        total={WORDS.length}
        onSettings={() => setSettingsOpen(true)}
      />

      {question && <Prompt word={question.word} direction={state.direction} />}

      {question && (
        <Options
          options={question.options}
          targetId={question.word.id}
          direction={state.direction}
          feedback={feedback}
          onSelect={answer}
        />
      )}

      <SettingsSheet
        open={settingsOpen}
        direction={state.direction}
        onDirection={changeDirection}
        onReset={resetAll}
        onClose={() => setSettingsOpen(false)}
      />

      {won && !feedback && <WinOverlay total={WORDS.length} bestStreak={state.bestStreak} onRestart={resetAll} />}
    </div>
  )
}
