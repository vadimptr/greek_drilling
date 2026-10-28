import { useEffect, useRef, useState } from 'react'
import {
  completeGame, currentGame, newGame, saveLines, talk, CityError, type CharacterCard, type CityGame, type Line,
} from '../logic/city/api'
import { CITY_NAME } from '../logic/city/name'
import { startVoice, type VoiceCall, type VoiceHandlers } from '../logic/city/voice'
import type { Level } from '../types/word'

type Phase = 'loading' | 'idle' | 'generating' | 'connecting' | 'talking' | 'walking' | 'won'

interface Props {
  allowed: boolean | null
  signedIn: boolean
  level: Level
  onSignIn: () => void
}

const SUBS_KEY = 'greek_drilling.city.subs'
const LEAVE_AFTER_SPEECH_MS = 900
const LEAVE_IF_SILENT_MS = 2500
const WALK_MS = 1200

function readSubs(): boolean {
  try {
    return localStorage.getItem(SUBS_KEY) === '1'
  } catch {
    return false
  }
}

function errorText(e: unknown): string {
  if (e instanceof CityError) return e.message
  if (e instanceof DOMException && e.name === 'NotAllowedError') return 'Доступ к микрофону запрещён. Разреши его в настройках браузера.'
  return 'Не получилось начать разговор, попробуй ещё раз'
}

export function CityScreen({ allowed, signedIn, level, onSignIn }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [game, setGame] = useState<CityGame | null>(null)
  const [character, setCharacter] = useState<CharacterCard | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subs, setSubs] = useState(readSubs)

  const gameRef = useRef<CityGame | null>(null)
  const currentRef = useRef<string | null>(null)
  const callRef = useRef<VoiceCall | null>(null)
  const linesRef = useRef<Line[]>([])
  const modeRef = useRef<'speaking' | 'listening'>('listening')
  const pendingRef = useRef<string | null>(null)
  const wonRef = useRef(false)
  const timerRef = useRef<number | undefined>(undefined)
  const callSeq = useRef(0)

  const applyGame = (g: CityGame | null) => {
    gameRef.current = g
    setGame(g)
  }

  useEffect(() => {
    if (!allowed) {
      setPhase(allowed === null ? 'loading' : 'idle')
      return
    }
    let alive = true
    currentGame()
      .then((g) => {
        if (!alive) return
        applyGame(g)
        setPhase('idle')
      })
      .catch((e) => {
        if (!alive) return
        setError(errorText(e))
        setPhase('idle')
      })
    return () => {
      alive = false
      window.clearTimeout(timerRef.current)
      callSeq.current++
      void callRef.current?.end()
    }
  }, [allowed])

  const toggleSubs = () => {
    const next = !subs
    setSubs(next)
    try {
      localStorage.setItem(SUBS_KEY, next ? '1' : '0')
    } catch {
      return
    }
  }

  const leave = () => {
    window.clearTimeout(timerRef.current)
    void callRef.current?.end()
  }

  const scheduleLeave = (ms: number) => {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(leave, ms)
  }

  const finishCall = (seq: number) => {
    if (seq !== callSeq.current || callRef.current === null) return
    callRef.current = null
    window.clearTimeout(timerRef.current)
    setSpeaking(false)
    const g = gameRef.current
    const from = currentRef.current
    if (g && from && linesRef.current.length) void saveLines(g.id, from, linesRef.current).catch(() => undefined)
    const target = pendingRef.current
    pendingRef.current = null
    if (wonRef.current) {
      setPhase('won')
    } else if (target && g) {
      setPhase('walking')
      window.setTimeout(() => void connectTo(g, target, from), WALK_MS)
    } else {
      setPhase('idle')
    }
  }

  const handlers = (seq: number): VoiceHandlers => ({
    onLine: (role, text) => {
      if (seq !== callSeq.current || !text.trim()) return
      linesRef.current = [...linesRef.current, { role, text }]
      setLines(linesRef.current)
    },
    onMode: (mode) => {
      if (seq !== callSeq.current) return
      modeRef.current = mode
      setSpeaking(mode === 'speaking')
      if (!pendingRef.current) return
      if (mode === 'speaking') window.clearTimeout(timerRef.current)
      else scheduleLeave(LEAVE_AFTER_SPEECH_MS)
    },
    onTool: (name, params) => {
      const g = gameRef.current
      const current = currentRef.current
      if (seq !== callSeq.current || !g || !current) return 'not available'
      if (name === 'go_to') {
        const target = String(params.character_id ?? '')
        if (target === current || !g.characters.some((c) => c.id === target)) return 'unknown person'
        pendingRef.current = target
        scheduleLeave(modeRef.current === 'listening' ? LEAVE_IF_SILENT_MS : 15_000)
        return 'ok'
      }
      completeGame(g.id, current)
        .then((done) => {
          applyGame(done)
          wonRef.current = true
        })
        .catch(() => undefined)
      return 'ok'
    },
    onEnd: () => finishCall(seq),
    onError: (message) => {
      if (seq !== callSeq.current) return
      setError(message || 'Связь прервалась')
    },
  })

  const connectTo = async (g: CityGame, characterId: string, from: string | null) => {
    setError(null)
    setPhase('connecting')
    const seq = ++callSeq.current
    try {
      const t = await talk(g.id, characterId, from)
      if (seq !== callSeq.current) return
      applyGame(t.game)
      currentRef.current = characterId
      setCharacter(t.character)
      linesRef.current = []
      setLines([])
      modeRef.current = 'listening'
      const call = await startVoice(t.session, handlers(seq))
      if (seq !== callSeq.current) {
        void call.end()
        return
      }
      callRef.current = call
      setPhase('talking')
    } catch (e) {
      if (seq !== callSeq.current) return
      setError(errorText(e))
      setPhase('idle')
    }
  }

  const startNew = async () => {
    setError(null)
    setPhase('generating')
    setCharacter(null)
    currentRef.current = null
    wonRef.current = false
    try {
      const g = await newGame(level)
      applyGame(g)
      await connectTo(g, g.startId, null)
    } catch (e) {
      setError(errorText(e))
      setPhase('idle')
    }
  }

  const onMic = () => {
    if (phase === 'talking') {
      leave()
      return
    }
    if (phase !== 'idle' && phase !== 'won') return
    const g = gameRef.current
    if (!g || g.status === 'won') {
      void startNew()
      return
    }
    void connectTo(g, currentRef.current ?? g.startId, null)
  }

  const approach = (id: string) => {
    const g = gameRef.current
    if (g && phase === 'idle') void connectTo(g, id, currentRef.current)
  }

  const busy = phase === 'loading' || phase === 'generating' || phase === 'connecting' || phase === 'walking'
  const active = game && game.status === 'active'
  const known = active ? game.characters.filter((c) => game.known.includes(c.id)) : []
  const walkingTo = pendingRef.current && game?.characters.find((c) => c.id === pendingRef.current)

  return (
    <main className="speak city">
      <div className="speak-card city-scene">
        {phase === 'generating' && <div className="city-hint">Придумываю историю…</div>}
        {phase === 'walking' && <div className="city-hint">Идёшь дальше по городу…{walkingTo ? ` ${walkingTo.name}` : ''}</div>}
        {(phase === 'connecting' || phase === 'talking' || (phase === 'idle' && character)) && character && (
          <>
            <div className={speaking ? 'city-name city-name-speaking' : 'city-name'}>{character.name}</div>
            <div className="speak-ru">{character.role} · {character.place}</div>
          </>
        )}
        {phase === 'idle' && !character && (
          <div className="city-hint">
            {!allowed
              ? `${CITY_NAME} — выдуманный греческий городок у моря. Ты турист, который только что сошёл с парома: получаешь задание и выполняешь его, разговаривая голосом с жителями по-гречески.`
              : active
                ? 'Нажми на микрофон, чтобы продолжить'
                : `Нажми на микрофон — и ты сойдёшь с парома в ${CITY_NAME}`}
          </div>
        )}
        {phase === 'won' && <div className="city-won">Задание выполнено! 🎉</div>}
        {subs && lines.length > 0 && (
          <div className="city-subs">
            {lines.slice(-4).map((l, i) => (
              <div key={i} className={l.role === 'user' ? 'city-line city-line-me' : 'city-line'}>
                {l.text}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="speak-controls">
        <button
          className={phase === 'talking' ? 'mic-btn mic-listening' : 'mic-btn'}
          onClick={onMic}
          disabled={busy || !allowed}
          aria-label={phase === 'talking' ? 'Закончить разговор' : 'Начать разговор'}
        >
          {busy ? '…' : phase === 'talking' ? '■' : '🎤'}
        </button>
        {game && phase !== 'generating' && (
          <div className={game.status === 'won' ? 'city-goal city-goal-done' : 'city-goal'}>🎯 {game.goal}</div>
        )}
        <div className="speak-status" aria-live="polite">
          {error && <span className="speak-bad">{error}</span>}
          {!error && phase === 'connecting' && 'Подхожу…'}
          {!error && phase === 'talking' && (speaking ? 'Говорит…' : 'Слушает тебя')}
          {!error && phase === 'won' && 'Нажми на микрофон — будет новое задание'}
          {allowed === false && !signedIn && (
            <>
              Разговоры с жителями доступны по приглашению.{' '}
              <button className="link-btn" onClick={onSignIn}>
                Войти
              </button>
            </>
          )}
          {allowed === false && signedIn && 'Разговоры с жителями пока доступны только по приглашению'}
        </div>
        {phase === 'idle' && known.length > 0 && (
          <div className="city-people">
            {known.map((c) => (
              <button key={c.id} className="secondary-btn" onClick={() => approach(c.id)}>
                {c.name}
                <span className="city-people-role">{c.role}</span>
              </button>
            ))}
          </div>
        )}
        <div className="speak-actions">
          {allowed && (
            <button className="secondary-btn" onClick={toggleSubs}>
              {subs ? 'Скрыть субтитры' : 'Субтитры'}
            </button>
          )}
          {phase === 'idle' && active && (
            <button className="secondary-btn" onClick={() => void startNew()}>
              Другое задание
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
