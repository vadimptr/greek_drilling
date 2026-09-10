import { useCallback, useEffect, useRef, useState } from 'react'
import { WORDS } from '../data/words'
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
  onChange: (next: SpeakState) => void
}

export function SpeakScreen({ state, hint, onChange }: Props) {
  const [word, setWord] = useState<Word | null>(() => pickNext(state, WORDS))
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
    if (word === null && !isWin(state, WORDS)) setWord(pickNext(state, WORDS))
  }, [state, word])

  const advance = useCallback(
    (next: SpeakState) => {
      setPhase('idle')
      setHeard('')
      setInfoOpen(false)
      setWord(pickNext(next, WORDS))
    },
    [],
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
        const next = applyAnswer(state, word.id, true)
        onChange(next)
        setPhase('correct')
        timer.current = window.setTimeout(() => {
          timer.current = null
          advance(next)
        }, CORRECT_DELAY_MS)
      } else {
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

  const won = isWin(state, WORDS)
  const micBlocked = mic === 'denied' || mic === 'unsupported'
  const busy = phase === 'listening' || phase === 'processing'

  const cardClass =
    phase === 'correct' ? 'speak-card speak-card-ok' : phase === 'wrong' ? 'speak-card speak-card-bad' : 'speak-card'

  return (
    <main className="speak">
      {word && (
        <div key={`${word.id}-${phase === 'correct' || phase === 'wrong' ? phase : ''}`} className={cardClass}>
          <button className="speak-word" onClick={() => setInfoOpen(true)} aria-label="Показать сведения о слове">
            {hint === 'el' ? word.el : word.ru}
          </button>
          {hint === 'el' && (
            <>
              <div className="speak-translit">{transliterate(word.el)}</div>
              <div className="speak-ru">{word.ru}</div>
            </>
          )}
          {hint === 'ru' && phase === 'wrong' && <div className="speak-reveal">{word.el}</div>}
        </div>
      )}

      <div className="speak-status" aria-live="polite">
        {phase === 'idle' && !micBlocked && 'Нажми на микрофон и произнеси слово'}
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

      <div className="speak-controls">
        <button
          className={phase === 'listening' ? 'mic-btn mic-listening' : 'mic-btn'}
          style={{ ['--level' as string]: Math.min(1, level * 12) }}
          onClick={listen}
          disabled={!word || micBlocked || phase === 'processing' || phase === 'correct' || phase === 'wrong'}
          aria-label={phase === 'listening' ? 'Остановить запись' : 'Сказать слово'}
        >
          {phase === 'processing' ? '…' : phase === 'listening' ? '■' : '🎤'}
        </button>
        <div className="speak-actions">
          {phase === 'wrong' ? (
            <button className="primary-btn" onClick={nextAfterWrong}>
              Дальше
            </button>
          ) : (
            <>
              {speechAvailable && (
                <button className="secondary-btn" onClick={() => word && speak(word.el)} disabled={!word || busy}>
                  🔊 Послушать
                </button>
              )}
              <button className="secondary-btn" onClick={skip} disabled={!word || busy}>
                Пропустить
              </button>
            </>
          )}
        </div>
      </div>

      <WordInfoPopup word={infoOpen && word ? word : null} onClose={() => setInfoOpen(false)} />
      {won && <WinOverlay total={WORDS.length} bestStreak={state.bestStreak} onRestart={restart} />}
    </main>
  )
}
