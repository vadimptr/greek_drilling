import { useEffect, useRef, useState } from 'react'
import {
  completeGame, currentGame, introduce, newGame, requestScene, unlockCity, type LevelCheck, revealFacts, saveLines, setMood, translateCached, talk, CityError, type CharacterCard, type CityGame, type Line,
} from '../logic/city/api'
import { Notebook } from '../components/city/Notebook'
import { Tip } from '../components/city/Tip'
import { Translated } from '../components/city/Translated'
import { Progress } from '../components/city/Progress'
import { useAmbience } from '../logic/city/useAmbience'
import { CITY_NAME } from '../logic/city/name'
import { startVoice, type VoiceCall, type VoiceHandlers } from '../logic/city/voice'
import type { Level } from '../types/word'

type Phase = 'loading' | 'idle' | 'generating' | 'painting' | 'connecting' | 'talking' | 'paused' | 'walking' | 'won'

interface Props {
  allowed: boolean | null
  signedIn: boolean
  needsCode: boolean
  onUnlocked: () => void
  level: Level
  speed: number
  ambienceVolume: number
  storyMs: number
  onSignIn: () => void
  onTotal: (total: number) => void
}

const SUBS_KEY = 'greek_drilling.city.subs'
const LEAVE_AFTER_SPEECH_MS = 900
const LEAVE_AFTER_GOODBYE_MS = 300
const FACT_SPEECH_WINDOW_MS = 8000
const WALK_MS = 1200
const FRESH_MS = 4000
const SCENE_POLL_MS = 2000
const SCENE_WAIT_MS = 180_000
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

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

export function CityScreen({ allowed, signedIn, needsCode, onUnlocked, level, speed, ambienceVolume, storyMs, onSignIn, onTotal }: Props) {
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
  const [paintingId, setPaintingId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  const submitCode = async () => {
    if (!code.trim() || unlocking) return
    setUnlocking(true)
    setCodeError(null)
    try {
      await unlockCity(code)
      onUnlocked()
    } catch (e) {
      setCodeError(e instanceof CityError ? e.message : 'Не получилось проверить код')
    } finally {
      setUnlocking(false)
    }
  }
  const [levelCheck, setLevelCheck] = useState<{ who: string; check: LevelCheck } | null>(null)
  const [gameAt, setGameAt] = useState(() => Date.now())
  const freshTimer = useRef<number | undefined>(undefined)

  const gameRef = useRef<CityGame | null>(null)
  const currentRef = useRef<string | null>(null)
  const callRef = useRef<VoiceCall | null>(null)
  const linesRef = useRef<Line[]>([])
  const modeRef = useRef<'speaking' | 'listening'>('listening')
  const pendingRef = useRef<string | null>(null)
  const walkAwayRef = useRef(false)
  const endingRef = useRef(false)
  const leavingRef = useRef(false)
  const lastSpokeRef = useRef<string | null>(null)
  const lastAgentLineRef = useRef(0)
  const pendingFactsRef = useRef<{ id: string; at: number }[]>([])
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
    leavingRef.current = true
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
    if (g && from && linesRef.current.length) {
      const who = g.notebook.find((p) => p.id === from)?.name ?? ''
      void saveLines(g.id, from, linesRef.current)
        .then((r) => {
          applyIfCurrent(r.game)
          if (r.check && gameRef.current?.id === g.id) setLevelCheck({ who, check: r.check })
        })
        .catch(() => undefined)
    }
    const target = pendingRef.current
    pendingRef.current = null
    if (walkAwayRef.current) {
      walkAwayRef.current = false
      const who = g?.notebook.find((p) => p.id === from)
      setNotice(`${who?.name ?? 'Собеседник'} не хочет больше с тобой разговаривать`)
    }
    endingRef.current = false
    const dropped = !leavingRef.current && !walkAwayRef.current && !target && !wonRef.current
    leavingRef.current = false
    if (dropped) {
      setPhase('paused')
      return
    }
    lastSpokeRef.current = from
    currentRef.current = null
    setCharacter(null)
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
      if (role === 'agent') {
        lastAgentLineRef.current = Date.now()
        const g = gameRef.current
        const current = currentRef.current
        const fresh = pendingFactsRef.current.filter((f) => Date.now() - f.at < FACT_SPEECH_WINDOW_MS).map((f) => f.id)
        pendingFactsRef.current = []
        if (g && current && fresh.length) void revealFacts(g.id, current, fresh).then(applyIfCurrent).catch(() => undefined)
      }
      if (subsRef.current) void translateCached(text).catch(() => undefined)
      setLines(linesRef.current)
    },
    onMode: (mode) => {
      if (seq !== callSeq.current) return
      modeRef.current = mode
      setSpeaking(mode === 'speaking')
      if (!pendingRef.current && !walkAwayRef.current && !endingRef.current) return
      if (mode === 'speaking') window.clearTimeout(timerRef.current)
      else scheduleLeave(pendingRef.current ? LEAVE_AFTER_SPEECH_MS : LEAVE_AFTER_GOODBYE_MS)
    },
    onTool: (name, params) => {
      const g = gameRef.current
      const current = currentRef.current
      if (seq !== callSeq.current || !g || !current) return 'not available'
      if (name === 'introduce' || name === 'go_to') {
        const target = String(params.character_id ?? '')
        if (target && target !== current) void introduce(g.id, current, target).then(applyIfCurrent).catch(() => undefined)
        if (name === 'introduce') return 'ok'
      }
      if (name === 'end_talk' || name === 'go_to') {
        endingRef.current = true
        scheduleLeave(modeRef.current === 'listening' ? LEAVE_AFTER_GOODBYE_MS : 15_000)
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
        scheduleLeave(modeRef.current === 'listening' ? LEAVE_AFTER_GOODBYE_MS : 15_000)
        return 'ok'
      }
      if (name === 'reveal_fact') {
        const factId = String(params.fact_id ?? '')
        if (!factId) return 'ok'
        if (Date.now() - lastAgentLineRef.current < FACT_SPEECH_WINDOW_MS) {
          void revealFacts(g.id, current, [factId]).then(applyIfCurrent).catch(() => undefined)
        } else {
          pendingFactsRef.current.push({ id: factId, at: Date.now() })
        }
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

  const connectTo = async (g: CityGame, characterId: string, from: string | null, resume?: 'voice' | 'tap') => {
    setError(null)
    setNotice(null)
    setLevelCheck(null)
    const seq = ++callSeq.current
    try {
      if (!resume && g.scenesEnabled && !g.characters.find((c) => c.id === characterId)?.scene) {
        setPhase('painting')
        setPaintingId(characterId)
        const drawn = await waitScene(g, characterId, seq)
        setPaintingId(null)
        if (seq !== callSeq.current) return
        if (!drawn) setNotice('Картинку нарисовать не получилось — играем без неё')
      }
      setPhase('connecting')
      const t = await talk(g.id, characterId, from, speedRef.current, resume)
      if (seq !== callSeq.current) return
      applyGame(t.game)
      currentRef.current = characterId
      setCharacter(t.character)
      linesRef.current = []
      setLines([])
      lastAgentLineRef.current = 0
      pendingFactsRef.current = []
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

  const waitScene = async (g: CityGame, characterId: string, seq: number): Promise<boolean> => {
    const until = Date.now() + SCENE_WAIT_MS
    let fresh = await requestScene(g.id, characterId).catch(() => null)
    let idle = 0
    while (Date.now() < until && seq === callSeq.current) {
      if (!fresh) return false
      if (fresh.id === g.id) {
        applyIfCurrent(fresh)
        const c = fresh.characters.find((x) => x.id === characterId)
        const st = c?.sceneState
        if (c?.scene) return true
        if (!fresh.scenesEnabled || st?.state === 'failed') return false
        if (st?.state === 'drawing' && st.elapsedMs > Math.max(60_000, st.expectedMs * 2.5)) return false
        idle = st?.state === 'none' ? idle + 1 : 0
        if (idle >= 3) return false
      }
      await sleep(SCENE_POLL_MS)
      fresh = await currentGame().catch(() => null)
    }
    return false
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
    lastSpokeRef.current = null
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

  const resumeTalk = (kind: 'tap') => {
    const g = gameRef.current
    const id = currentRef.current
    if (g && id) void connectTo(g, id, null, kind)
  }

  const stepAway = () => {
    lastSpokeRef.current = currentRef.current
    currentRef.current = null
    setCharacter(null)
    setPhase('idle')
  }

  const onMic = () => {
    if (phase === 'talking') {
      leave()
      return
    }
    if (phase === 'paused') {
      resumeTalk('tap')
      return
    }
    if (phase !== 'idle' && phase !== 'won') return
    const g = gameRef.current
    if (!g || g.status === 'won') {
      void startNew()
      return
    }
    if (g.met.length === 0) void connectTo(g, g.startId, null)
  }

  const approach = (id: string) => {
    const g = gameRef.current
    if (!g || g.status !== 'active' || id === currentRef.current) return
    if (phase === 'talking') {
      pendingRef.current = id
      leave()
    } else if (phase === 'paused') {
      void connectTo(g, id, currentRef.current)
    } else if (phase === 'idle') {
      void connectTo(g, id, lastSpokeRef.current)
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

  const done = allowed === true && game?.status === 'won' && (phase === 'won' || phase === 'idle')
  const busy = phase === 'loading' || phase === 'generating' || phase === 'painting' || phase === 'connecting' || phase === 'walking'
  const active = game && game.status === 'active'
  const walkingTo = pendingRef.current && game?.characters.find((c) => c.id === pendingRef.current)

  const sceneOf = (id: string | null | undefined) => (id ? (game?.characters.find((c) => c.id === id)?.scene ?? null) : null)
  const shownId = phase === 'painting' ? paintingId : (character?.id ?? (active && game?.met.length === 0 ? game.startId : null))
  const choosing = !!active && phase === 'idle' && !character && (game?.met.length ?? 0) > 0
  const scene = phase === 'generating' || phase === 'walking' ? null : sceneOf(shownId)
  const sceneState = phase === 'generating' || phase === 'walking' || scene ? null : game?.characters.find((c) => c.id === shownId)?.sceneState
  const soundOn = phase === 'painting' || phase === 'connecting' || phase === 'talking' || phase === 'paused' || (phase === 'idle' && !!character) || phase === 'won'
  const ambienceUrl = allowed && soundOn ? (game?.characters.find((c) => c.id === shownId)?.ambience ?? null) : null
  useAmbience(ambienceUrl, ambienceVolume, speaking)
  const showSpeaker = !!character && (phase === 'connecting' || phase === 'talking' || phase === 'paused' || phase === 'idle')

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
              <Progress
                label={phase === 'painting' ? 'Рисую сцену, потом начнём разговор…' : 'Рисую сцену…'}
                startedAt={gameAt - sceneState.elapsedMs}
                expectedMs={sceneState.expectedMs}
              />
            )}
            {phase === 'painting' && (!sceneState || sceneState.state === 'none') && <div className="city-hint city-hint-small">🎨 Готовлю сцену…</div>}
            {phase !== 'generating' && sceneState?.state === 'queued' && <div className="city-hint city-hint-small">🎨 Сцена в очереди на отрисовку</div>}
            {phase === 'walking' && <div className="city-hint">Идёшь дальше по городу…{walkingTo ? ` ${walkingTo.name}` : ''}</div>}
            {done && (
              <div className="city-won-card">
                <div className="city-won">Задание выполнено! 🎉</div>
                <button className="primary-btn" onClick={() => void startNew()}>
                  Новое задание
                </button>
              </div>
            )}
            {phase === 'idle' && !character && !done && (
              <div className="city-hint">
                {!allowed
                  ? `${CITY_NAME} — выдуманный греческий городок у моря. Ты турист, который только что сошёл с парома: получаешь задание и выполняешь его, разговаривая голосом с жителями по-гречески.`
                  : active
                    ? choosing
                      ? 'Ты отошёл от собеседника. Выбери в блокноте, к кому подойти'
                      : 'Нажми на микрофон, чтобы подойти к первому человеку'
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
          {!error && notice && <div className="city-notice">{notice}</div>}
          <div className="speak-status" aria-live="polite">
            {error && <span className="speak-bad">{error}</span>}
            {!error && phase === 'connecting' && 'Подхожу…'}
            {!error && phase === 'talking' && (speaking ? 'Говорит…' : 'Слушает тебя')}
            {!error && phase === 'paused' && '⏸ Ты долго молчал — нажми на микрофон, чтобы продолжить'}
            {!error && done && 'Задание выполнено — начни новое кнопкой или микрофоном'}
            {allowed === false && !signedIn && (
              <>
                Разговоры с жителями доступны по приглашению.{' '}
                <button className="link-btn" onClick={onSignIn}>
                  Войти
                </button>
              </>
            )}
            {allowed === false && signedIn && !needsCode && 'Разговоры с жителями пока доступны только по приглашению'}
          {allowed === false && signedIn && needsCode && (
            <form
              className="city-code"
              onSubmit={(e) => {
                e.preventDefault()
                void submitCode()
              }}
            >
              <span>Введи код доступа к городу:</span>
              <input
                className="account-input city-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="XXXX-XXXX"
                autoComplete="one-time-code"
                aria-label="Код доступа"
              />
              <button className="primary-btn" type="submit" disabled={unlocking || !code.trim()}>
                Открыть
              </button>
              {codeError && <span className="speak-bad">{codeError}</span>}
            </form>
          )}
          </div>
          {levelCheck && phase === 'idle' && (
            <Tip
              text={
                levelCheck.check.issues.length
                  ? levelCheck.check.issues.map((i) => `«${i.text}» — ${i.reason}`).join('\n')
                  : `Все реплики подходят для ${levelCheck.check.level}`
              }
            >
              <span className={levelCheck.check.issues.length ? 'city-level city-level-warn' : 'city-level'}>
                📏 {levelCheck.who}: {levelCheck.check.total - levelCheck.check.issues.length} из {levelCheck.check.total} реплик по уровню{' '}
                {levelCheck.check.level}
              </span>
            </Tip>
          )}
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
              disabled={busy || !allowed || choosing}
              aria-label={phase === 'talking' ? 'Закончить разговор' : 'Начать разговор'}
            >
              {busy ? '…' : phase === 'talking' ? '■' : phase === 'paused' ? '▶' : '🎤'}
            </button>
            <div className="city-dock-side">
              {phase === 'paused' && (
                <button className="secondary-btn" onClick={stepAway}>
                  Отойти
                </button>
              )}
              {phase === 'idle' && active && (
                <button className="secondary-btn" onClick={() => void startNew()}>
                  Другое задание
                </button>
              )}
              {done && (
                <button className="secondary-btn" onClick={() => void startNew()}>
                  Новое задание
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
          current={phase === 'talking' || phase === 'connecting' || phase === 'paused' ? currentRef.current : null}
          canPick={active === true && (phase === 'idle' || phase === 'talking' || phase === 'paused')}
          onPick={approach}
        />
      )}
    </div>
  )
}
