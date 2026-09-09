import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { WORDS } from './data/words'
import { buildOptions } from './logic/options'
import { pickNext } from './logic/pick'
import { canSpeak, speak, warmUpVoices } from './logic/speech'
import { applyAnswer, isWin, restart, type RoundState } from './logic/state'
import { loadState, saveState } from './logic/storage'
import type { Direction, Word } from './types/word'
import { Header } from './components/Header'
import { Prompt } from './components/Prompt'
import { Options, type Feedback } from './components/Options'
import { SettingsSheet } from './components/SettingsSheet'
import { WinOverlay } from './components/WinOverlay'
import { WordInfoPopup } from './components/WordInfoPopup'

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

export default function App() {
  const [state, setState] = useState<RoundState>(() => loadState(localStorage, WORDS))
  const [question, setQuestion] = useState<Question | null>(() => makeQuestion(state))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const timer = useRef<number | null>(null)
  const interacted = useRef(false)

  useEffect(() => {
    warmUpVoices()
  }, [])

  useEffect(() => {
    saveState(localStorage, state)
  }, [state])

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

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
      setState(next)
      // в направлении «русский → греческий» озвучиваем правильный ответ
      if (next.autoSpeak && next.direction === 'ru-el') speak(question.word.el)
      timer.current = window.setTimeout(() => {
        timer.current = null
        setFeedback(null)
        setInfoOpen(false)
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
    setInfoOpen(false)
    setQuestion(makeQuestion(next))
    setSettingsOpen(false)
  }

  const speakCurrent = () => {
    interacted.current = true
    if (question) speak(question.word.el)
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

      <SettingsSheet
        open={settingsOpen}
        direction={state.direction}
        autoSpeak={state.autoSpeak}
        canSpeak={speechAvailable}
        onDirection={changeDirection}
        onAutoSpeak={(autoSpeak) => setState({ ...state, autoSpeak })}
        onReset={resetAll}
        onClose={() => setSettingsOpen(false)}
      />

      {won && !feedback && <WinOverlay total={WORDS.length} bestStreak={state.bestStreak} onRestart={resetAll} />}
    </div>
  )
}
