import { useEffect, useRef, useState } from 'react'
import {
  completeGame, currentGame, newGame, revealFacts, saveLines, setMood, translateCached, talk, CityError, type CharacterCard, type CityGame, type Line,
} from '../logic/city/api'
import { Notebook } from '../components/city/Notebook'
import { Tip } from '../components/city/Tip'
import { Translated } from '../components/city/Translated'
import { Progress } from '../components/city/Progress'
import { CITY_NAME } from '../logic/city/name'
import { startVoice, type VoiceCall, type VoiceHandlers } from '../logic/city/voice'
import type { Level } from '../types/word'

type Phase = 'loading' | 'idle' | 'generating' | 'connecting' | 'talking' | 'walking' | 'won'

interface Props {
  allowed: boolean | null
  signedIn: boolean
  level: Level
  speed: number
  storyMs: number
  onSignIn: () => void
  onTotal: (total: number) => void
}

const SUBS_KEY = 'greek_drilling.city.subs'
const LEAVE_AFTER_SPEECH_MS = 900
const LEAVE_IF_SILENT_MS = 2500
const WALK_MS = 1200
const FRESH_MS = 4000

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

export function CityScreen({ allowed, signedIn, level, speed, storyMs, onSignIn, onTotal }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [game, setGame] = useState<CityGame | null>(null)
  const [character, setCharacter] = useState<CharacterCard | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subs, setSubs] = useState(readSubs)
  const subsRef = useRef(subs)
  subsRef.current = subs
  const speedRef = useRef(speed)
  speedRef.current = speed
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [storyStartedAt, setStoryStartedAt] = useState(0)
  const [gameAt, setGameAt] = useState(() => Date.now())
  const freshTimer = useRef<number | undefined>(undefined)

  const gameRef = useRef<CityGame | null>(null)
  const currentRef = useRef<string | null>(null)
  const callRef = useRef<VoiceCall | null>(null)
  const linesRef = useRef<Line[]>([])
  const modeRef = useRef<'speaking' | 'listening'>('listening')
  const pendingRef = useRef<string | null>(null)
  const walkAwayRef = useRef(false)
  const [notice, setNotice] = useState<string | null>(null)
  const wonRef = useRef(false)
  const timerRef = useRef<number | undefined>(undefined)
  const callSeq = useRef(0)

  const applyGame = (g: CityGame | null) => {
    const prev = gameRef.current
    if (g && prev && g.id === prev.id) {
      const before = new Set(prev.notebook.flatMap((p) => p.facts.map((f) => f.id)))
      const added = g.notebook.flatMap((p) => p.facts.filter((f) => f.points > 0 && !before.has(f.id)).map((f) => f.id))
      if (added.length) {
        setFresh(new Set(added))
        window.clearTimeout(freshTimer.current)
        freshTimer.current = window.setTimeout(() => setFresh(new Set()), FRESH_MS)
      }
    }
    if (g?.status === 'won' && callRef.current) wonRef.current = true
    gameRef.current = g
    setGame(g)
    setGameAt(Date.now())
    if (g) onTotal(g.total)
  }

  const applyIfCurrent = (g: CityGame) => {
    if (gameRef.current?.id === g.id) applyGame(g)
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
      window.clearTimeout(freshTimer.current)
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
    if (g && from && linesRef.current.length) void saveLines(g.id, from, linesRef.current).then(applyIfCurrent).catch(() => undefined)
    const target = pendingRef.current
    pendingRef.current = null
    if (walkAwayRef.current) {
      walkAwayRef.current = false
      const who = g?.notebook.find((p) => p.id === from)
      setNotice(`${who?.name ?? 'Собеседник'} не хочет больше с тобой разговаривать`)
    }
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
      if (subsRef.current) void translateCached(text).catch(() => undefined)
      setLines(linesRef.current)
    },
    onMode: (mode) => {
      if (seq !== callSeq.current) return
      modeRef.current = mode
      setSpeaking(mode === 'speaking')
      if (!pendingRef.current && !walkAwayRef.current) return
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
      if (name === 'set_mood') {
        const mood = String(params.mood ?? '')
        const reason = String(params.reason ?? '')
        if (mood) void setMood(g.id, current, mood, reason).then(applyIfCurrent).catch(() => undefined)
        return 'ok'
      }
      if (name === 'walk_away') {
        walkAwayRef.current = true
        pendingRef.current = null
        scheduleLeave(modeRef.current === 'listening' ? LEAVE_AFTER_SPEECH_MS : 15_000)
        return 'ok'
      }
      if (name === 'reveal_fact') {
        const factId = String(params.fact_id ?? '')
        if (factId) void revealFacts(g.id, current, [factId]).then(applyIfCurrent).catch(() => undefined)
        return 'ok'
      }
      completeGame(g.id, current)
        .then((done) => {
          applyIfCurrent(done)
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
    setNotice(null)
    setPhase('connecting')
    const seq = ++callSeq.current
    try {
      const t = await talk(g.id, characterId, from, speedRef.current)
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
    const previous = gameRef.current
    const previousCharacter = character
    setError(null)
    setNotice(null)
    setPhase('generating')
    setStoryStartedAt(Date.now())
    setCharacter(null)
    setLines([])
    currentRef.current = null
    wonRef.current = false
    gameRef.current = null
    setGame(null)
    try {
      const g = await newGame(level)
      applyGame(g)
      await connectTo(g, g.startId, null)
    } catch (e) {
      if (previous?.status === 'active') {
        gameRef.current = previous
        setGame(previous)
        setCharacter(previousCharacter)
      }
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
    if (!g || g.status !== 'active' || id === currentRef.current) return
    if (phase === 'talking') {
      pendingRef.current = id
      leave()
    } else if (phase === 'idle') {
      void connectTo(g, id, currentRef.current)
    }
  }


  const waitingScene = !!game && game.scenesEnabled && game.status === 'active' && game.characters.some((c) => !c.scene)

  useEffect(() => {
    if (!waitingScene) return
    const timer = window.setInterval(() => {
      currentGame()
        .then((g) => g && applyIfCurrent(g))
        .catch(() => undefined)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [waitingScene, game?.id])

  const busy = phase === 'loading' || phase === 'generating' || phase === 'connecting' || phase === 'walking'
  const active = game && game.status === 'active'
  const walkingTo = pendingRef.current && game?.characters.find((c) => c.id === pendingRef.current)

  const sceneOf = (id: string | null | undefined) => (id ? (game?.characters.find((c) => c.id === id)?.scene ?? null) : null)
  const shownId = character?.id ?? (active ? game?.startId : null)
  const scene = phase === 'generating' || phase === 'walking' ? null : sceneOf(shownId)
  const sceneState = phase === 'generating' || phase === 'walking' || scene ? null : game?.characters.find((c) => c.id === shownId)?.sceneState
  const showSpeaker = !!character && (phase === 'connecting' || phase === 'talking' || phase === 'idle')

  return (
    <div className="city-layout">
      <main className="city">
        {game && phase !== 'generating' && (
          <Tip text={game.goalRu} className="city-goal-wrap" placement="below">
            <div className={game.status === 'won' ? 'city-goal city-goal-done' : 'city-goal'}>🎯 {game.goal}</div>
          </Tip>
        )}

        <div className="city-stage">
          <div className="city-art">
            {scene ? (
              <img key={scene} className="city-art-img" src={scene} alt="" />
            ) : (
              <div className={phase === 'generating' || phase === 'walking' ? 'city-art-sea city-art-sea-busy' : 'city-art-sea'}>
                <span className="city-art-sun" />
                <span className="city-art-wave" />
              </div>
            )}
          </div>

          <div className="city-overlay">
            {phase === 'generating' && <Progress label="Придумываю историю…" startedAt={storyStartedAt} expectedMs={storyMs} />}
            {phase !== 'generating' && sceneState?.state === 'drawing' && (
              <Progress label="Рисую сцену…" startedAt={gameAt - sceneState.elapsedMs} expectedMs={sceneState.expectedMs} />
            )}
            {phase !== 'generating' && sceneState?.state === 'queued' && <div className="city-hint city-hint-small">🎨 Сцена в очереди на отрисовку</div>}
            {phase === 'walking' && <div className="city-hint">Идёшь дальше по городу…{walkingTo ? ` ${walkingTo.name}` : ''}</div>}
            {phase === 'won' && <div className="city-won">Задание выполнено! 🎉</div>}
            {phase === 'idle' && !character && (
              <div className="city-hint">
                {!allowed
                  ? `${CITY_NAME} — выдуманный греческий городок у моря. Ты турист, который только что сошёл с парома: получаешь задание и выполняешь его, разговаривая голосом с жителями по-гречески.`
                  : active
                    ? 'Нажми на микрофон, чтобы продолжить'
                    : `Нажми на микрофон — и ты сойдёшь с парома в ${CITY_NAME}`}
              </div>
            )}
          </div>

          <div className="city-bottom">
            {showSpeaker && (
              <div className="city-speaker">
                <div className={speaking ? 'city-name city-name-speaking' : 'city-name'}>{character.name}</div>
                <Tip text={`${character.roleRu} · ${character.placeRu}`}>
                  <span className="city-role">{character.role} · {character.place}</span>
                </Tip>
              </div>
            )}
            {subs && lines.length > 0 && (
              <div className="city-subs">
                {lines.slice(-4).map((l, i) => (
                  <Translated
                    key={Math.max(0, lines.length - 4) + i}
                    text={l.text}
                    className={l.role === 'user' ? 'city-line city-line-me' : 'city-line'}
                  >
                    {l.text}
                  </Translated>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="city-dock">
          <div className="speak-status" aria-live="polite">
            {error && <span className="speak-bad">{error}</span>}
            {!error && notice && phase === 'idle' && <span className="speak-bad">{notice}</span>}
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
          <div className="city-dock-row">
            <div className="city-dock-side">
              {allowed && (
                <button className="secondary-btn" onClick={toggleSubs}>
                  {subs ? 'Без субтитров' : 'Субтитры'}
                </button>
              )}
            </div>
            <button
              className={phase === 'talking' ? 'mic-btn mic-listening' : 'mic-btn'}
              onClick={onMic}
              disabled={busy || !allowed}
              aria-label={phase === 'talking' ? 'Закончить разговор' : 'Начать разговор'}
            >
              {busy ? '…' : phase === 'talking' ? '■' : '🎤'}
            </button>
            <div className="city-dock-side">
              {phase === 'idle' && active && (
                <button className="secondary-btn" onClick={() => void startNew()}>
                  Другое задание
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
      {allowed && game && (
        <Notebook
          people={game.notebook}
          score={game.score}
          fresh={fresh}
          current={phase === 'talking' || phase === 'connecting' ? currentRef.current : null}
          canPick={active === true && (phase === 'idle' || phase === 'talking')}
          onPick={approach}
        />
      )}
    </div>
  )
}
