import { useCallback, useEffect, useRef, useState } from 'react'
import { drillyAnswer } from '../logic/drilly'
import type { SpeakHint } from '../logic/appState'
import { matchesWord } from '../logic/match'
import { pickNext } from '../logic/pick'
import { canRecord, MicError, recordUtterance } from '../logic/recorder'
import { canSpeak, speak } from '../logic/speech'
import { restartSpeak, skipWord, type SpeakState } from '../logic/speakState'
import { applyAnswer, isWin } from '../logic/state'
import { transcribe } from '../logic/transcribe'
import { transliterate } from '../logic/translit'
import type { Word } from '../types/word'
import { WinOverlay } from '../components/WinOverlay'
import { WordInfoPopup } from '../components/WordInfoPopup'

type Phase = 'idle' | 'listening' | 'processing' | 'correct' | 'wrong' | 'unclear' | 'unavailable'
type Mic = 'unknown' | 'ok' | 'denied' | 'unsupported'

const CORRECT_DELAY_MS = 700
const speechAvailable = canSpeak()
const recordingAvailable = canRecord()

interface Props {
  state: SpeakState
  hint: SpeakHint
  words: Word[]
  onChange: (next: SpeakState) => void
}

export function SpeakScreen({ state, hint, words, onChange }: Props) {
  const [word, setWord] = useState<Word | null>(() => pickNext(state, words))
  const [phase, setPhase] = useState<Phase>('idle')
  const [heard, setHeard] = useState('')
  const [level, setLevel] = useState(0)
  const [mic, setMic] = useState<Mic>(recordingAvailable ? 'unknown' : 'unsupported')
  const [infoOpen, setInfoOpen] = useState(false)
  const stopper = useRef<AbortController | null>(null)
  const timer = useRef<number | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true // StrictMode в dev монтирует дважды — флаг надо поднимать заново
    return () => {
      alive.current = false
      stopper.current?.abort()
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  // сброс прогресса извне: нет слова, но и не победа — подобрать заново
  useEffect(() => {
    if (word === null && !isWin(state, words)) setWord(pickNext(state, words))
  }, [state, word, words])

  const advance = useCallback(
    (next: SpeakState) => {
      setPhase('idle')
      setHeard('')
      setInfoOpen(false)
      setWord(pickNext(next, words))
    },
    [words],
  )

  const listen = useCallback(async () => {
    if (!word) return
    if (phase === 'listening') {
      stopper.current?.abort()
      return
    }
    if (phase === 'processing' || phase === 'correct') return
    setHeard('')
    setPhase('listening')
    setLevel(0)
    const ctrl = new AbortController()
    stopper.current = ctrl
    try {
      const rec = await recordUtterance({ onLevel: setLevel, stop: ctrl.signal })
      if (!alive.current) return
      setLevel(0)
      setMic('ok')
      if (rec.kind === 'silence') {
        setPhase('unclear')
        return
      }
      setPhase('processing')
      const text = await transcribe(rec.wav)
      if (!alive.current) return
      setHeard(text)
      if (!text) {
        setPhase('unclear')
        return
      }
      if (matchesWord(text, word)) {
        drillyAnswer(true)
        const next = applyAnswer(state, word.id, true)
        onChange(next)
        setPhase('correct')
        timer.current = window.setTimeout(() => {
          timer.current = null
          advance(next)
        }, CORRECT_DELAY_MS)
      } else {
        drillyAnswer(false)
        onChange(applyAnswer(state, word.id, false))
        setPhase('wrong')
        if (speechAvailable) speak(word.el)
      }
    } catch (e) {
      if (!alive.current) return
      if (e instanceof MicError) {
        setMic(e.kind)
        setPhase('idle')
      } else {
        setPhase('unavailable')
      }
    } finally {
      stopper.current = null
    }
  }, [word, phase, state, onChange, advance])

  const skip = () => {
    if (!word || phase === 'listening' || phase === 'processing') return
    const next = skipWord(state, word.id)
    onChange(next)
    advance(next)
  }

  const nextAfterWrong = () => advance(state)

  const restart = () => {
    const next = restartSpeak(state)
    onChange(next)
    advance(next)
  }

  const listenRef = useRef(listen)
  listenRef.current = listen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      void listenRef.current()
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  const won = isWin(state, words)
  const micBlocked = mic === 'denied' || mic === 'unsupported'
  const busy = phase === 'listening' || phase === 'processing'

  const promptClass =
    phase === 'correct' ? 'trainer-prompt trainer-prompt-ok' : phase === 'wrong' ? 'trainer-prompt trainer-prompt-bad' : 'trainer-prompt'

  return (
    <main className="speak trainer">
      <div className="trainer-card">
        {word && (
          <div key={`${word.id}-${phase === 'correct' || phase === 'wrong' ? phase : ''}`} className={promptClass}>
            <span className="prompt-anchor">
              <button className="prompt-word speak-word" onClick={() => setInfoOpen(true)} aria-label="Показать сведения о слове">
                {hint === 'el' ? word.el : word.ru}
              </button>
              {speechAvailable && (
                <button className="speak-btn prompt-speak" onClick={() => speak(word.el)} disabled={busy} aria-label="Послушать">
                  🔊
                </button>
              )}
            </span>
            {hint === 'el' && (
              <>
                <div className="speak-translit">{transliterate(word.el)}</div>
                <div className="speak-ru">{word.ru}</div>
              </>
            )}
            {hint === 'ru' && phase === 'wrong' && <div className="speak-reveal">{word.el}</div>}
          </div>
        )}

        <div className="city-dock speak-dock">
          <div className="speak-status" aria-live="polite">
            {phase === 'idle' && !micBlocked && 'Нажми на микрофон или пробел и произнеси слово'}
            {phase === 'idle' && mic === 'denied' && 'Доступ к микрофону запрещён. Разреши его в настройках браузера для этого сайта.'}
            {phase === 'idle' && mic === 'unsupported' && 'Браузер не даёт доступ к микрофону. Открой сайт в Safari или Chrome по https.'}
            {phase === 'listening' && 'Слушаю… говори'}
            {phase === 'processing' && 'Распознаю…'}
            {phase === 'correct' && <span className="speak-ok">✓ Верно! {heard && <span className="speak-heard">«{heard}»</span>}</span>}
            {phase === 'wrong' && (
              <span className="speak-bad">
                ✗ Услышал: <span className="speak-heard">«{heard || '…'}»</span>
              </span>
            )}
            {phase === 'unclear' && 'Не расслышал, попробуй ещё раз'}
            {phase === 'unavailable' && 'Сервер распознавания недоступен, попробуй позже'}
          </div>
          <div className="city-dock-row">
            <div className="city-dock-side">
              <button className="secondary-btn" onClick={skip} disabled={!word || busy}>
                Пропустить
              </button>
            </div>
            <button
              className={phase === 'listening' ? 'mic-btn mic-listening' : 'mic-btn'}
              style={{ ['--level' as string]: Math.min(1, level * 12) }}
              onClick={listen}
              disabled={!word || micBlocked || phase === 'processing' || phase === 'correct'}
              aria-label={phase === 'listening' ? 'Остановить запись' : 'Сказать слово'}
            >
              {phase === 'processing' ? '…' : phase === 'listening' ? '■' : '🎤'}
            </button>
            <div className="city-dock-side">
              {phase === 'wrong' && (
                <button className="secondary-btn" onClick={nextAfterWrong}>
                  Дальше
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <WordInfoPopup word={infoOpen && word ? word : null} onClose={() => setInfoOpen(false)} />
      {won && <WinOverlay total={words.length} bestStreak={state.bestStreak} onRestart={restart} />}
    </main>
  )
}
