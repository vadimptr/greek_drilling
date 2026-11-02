import { useEffect, useRef, useState } from 'react'
import {
  currentGame, leaveTalk, newGame, requestScene, say, unlockCity, type LevelCheck, type Reply, translateCached, talk, CityError, type CharacterCard, type CityGame, type Line,
} from '../logic/city/api'
import { Notebook } from '../components/city/Notebook'
import { Tip } from '../components/city/Tip'
import { Translated } from '../components/city/Translated'
import { Progress } from '../components/city/Progress'
import { useAmbience } from '../logic/city/useAmbience'
import { CITY_NAMES, type Lang } from '../logic/city/name'
import { translate, useT, useUi } from '../logic/i18n'
import { Player, Recorder } from '../logic/city/recorder'
import type { Level } from '../types/word'

type Phase = 'loading' | 'idle' | 'generating' | 'painting' | 'connecting' | 'talking' | 'walking'
type TurnState = 'ready' | 'arming' | 'recording' | 'thinking' | 'speaking'

interface Props {
  allowed: boolean | null
  lang: Lang
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
const WALK_MS = 1200
const MIN_SPEECH_MS = 400
const SILENT_PEAK = 0.008
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

function money(usd: number): string {
  return usd < 1 ? `${(usd * 100).toFixed(usd < 0.1 ? 2 : 1)}¢` : `$${usd.toFixed(2)}`
}

function errorText(e: unknown, ui: Lang): string {
  if (e instanceof CityError) return e.message
  if (e instanceof DOMException && e.name === 'NotAllowedError') return translate(ui, 'city.micDenied')
  return translate(ui, 'city.startFailed')
}

export function CityScreen({ allowed, lang, signedIn, needsCode, onUnlocked, level, speed, ambienceVolume, storyMs, onSignIn, onTotal }: Props) {
  const t = useT()
  const ui = useUi()
  const city = CITY_NAMES[lang]
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
      setCodeError(e instanceof CityError ? e.message : t('city.codeFailed'))
    } finally {
      setUnlocking(false)
    }
  }
  const [levelCheck, setLevelCheck] = useState<{ who: string; check: LevelCheck } | null>(null)
  const [gameAt, setGameAt] = useState(() => Date.now())
  const freshTimer = useRef<number | undefined>(undefined)

  const gameRef = useRef<CityGame | null>(null)
  const currentRef = useRef<string | null>(null)
  const talkRef = useRef<string | null>(null)
  const linesRef = useRef<Line[]>([])
  const lastSpokeRef = useRef<string | null>(null)
  const recorder = useRef(new Recorder())
  const player = useRef(new Player())
  const pressedRef = useRef(false)
  const turnRef = useRef<TurnState>('ready')
  const [turn, setTurnState] = useState<TurnState>('ready')
  const [cost, setCost] = useState<{ turn: number | null; talk: number; game: number } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [walkingId, setWalkingId] = useState<string | null>(null)
  const micRef = useRef<HTMLButtonElement | null>(null)
  const callSeq = useRef(0)

  const setTurn = (next: TurnState) => {
    turnRef.current = next
    setTurnState(next)
    setSpeaking(next === 'speaking')
  }

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
    gameRef.current = g
    setGame(g)
    setGameAt(Date.now())
    if (g) onTotal(g.total)
  }

  const applyIfCurrent = (g: CityGame) => {
    if (gameRef.current?.id === g.id) applyGame(g)
  }

  const addLine = (line: Line) => {
    linesRef.current = [...linesRef.current, line]
    setLines(linesRef.current)
    if (subsRef.current) void translateCached(line.text).catch(() => undefined)
  }

  const closeTalk = () => {
    const id = talkRef.current
    talkRef.current = null
    pressedRef.current = false
    player.current.stop()
    recorder.current.close()
    return id
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
        setError(errorText(e, ui))
        setPhase('idle')
      })
    return () => {
      alive = false
      window.clearTimeout(freshTimer.current)
      callSeq.current++
      const id = closeTalk()
      if (id) void leaveTalk(id).catch(() => undefined)
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

  const finishTalk = (opts: { next?: string; walkedAway?: boolean } = {}) => {
    const g = gameRef.current
    const from = currentRef.current
    const who = g?.notebook.find((p) => p.id === from)?.name ?? ''
    callSeq.current++
    const id = closeTalk()
    setTurn('ready')
    if (id && g) {
      void leaveTalk(id)
        .then((r) => {
          applyIfCurrent(r.game)
          if (gameRef.current?.id !== g.id) return
          setCost((c) => (c ? { ...c, talk: r.total, game: r.spent } : c))
          if (r.check) setLevelCheck({ who, check: r.check })
        })
        .catch(() => undefined)
    }
    if (opts.walkedAway) setNotice(t('city.walkedAway', { name: who || t('city.someone') }))
    lastSpokeRef.current = from
    currentRef.current = null
    setCharacter(null)
    if (opts.next && g && g.status === 'active') {
      setPhase('walking')
      setWalkingId(opts.next)
      const next = opts.next
      window.setTimeout(() => void connectTo(g, next, from), WALK_MS)
    } else {
      setPhase('idle')
    }
  }

  const playReply = async (reply: Reply | null, seq: number) => {
    if (reply?.audio && seq === callSeq.current) {
      setTurn('speaking')
      await player.current.play(reply.audio)
    }
    if (seq === callSeq.current) setTurn('ready')
  }

  const connectTo = async (g: CityGame, characterId: string, from: string | null) => {
    setError(null)
    setNotice(null)
    setLevelCheck(null)
    const seq = ++callSeq.current
    try {
      if (g.scenesEnabled && !g.characters.find((c) => c.id === characterId)?.scene) {
        setPhase('painting')
        setPaintingId(characterId)
        const drawn = await waitScene(g, characterId, seq)
        setPaintingId(null)
        if (seq !== callSeq.current) return
        if (!drawn) setNotice(t('city.noScene'))
      }
      setPhase('connecting')
      const opened = await talk(g.id, characterId, from, speedRef.current)
      if (seq !== callSeq.current) {
        void leaveTalk(opened.talkId).catch(() => undefined)
        return
      }
      applyGame(opened.game)
      currentRef.current = characterId
      talkRef.current = opened.talkId
      setCharacter(opened.character)
      linesRef.current = []
      setLines([])
      setCost({ turn: opened.reply.cost, talk: opened.total, game: opened.spent })
      setPhase('talking')
      if (opened.reply.text) addLine({ role: 'agent', text: opened.reply.text, cost: opened.reply.cost })
      await playReply(opened.reply, seq)
    } catch (e) {
      if (seq !== callSeq.current) return
      setError(errorText(e, ui))
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

  const press = async () => {
    if (phase !== 'talking' || !talkRef.current || pressedRef.current) return
    if (turnRef.current === 'speaking') player.current.stop()
    else if (turnRef.current !== 'ready') return
    pressedRef.current = true
    setError(null)
    setNotice(null)
    setTurn('arming')
    const seq = callSeq.current
    try {
      await recorder.current.start()
    } catch (e) {
      pressedRef.current = false
      if (seq !== callSeq.current) return
      setError(errorText(e, ui))
      setTurn('ready')
      return
    }
    if (seq !== callSeq.current) return
    if (!pressedRef.current) {
      await recorder.current.stop()
      setNotice(t('city.tooShort'))
      setTurn('ready')
      return
    }
    setTurn('recording')
  }

  const release = async () => {
    if (!pressedRef.current) return
    pressedRef.current = false
    if (turnRef.current !== 'recording') return
    const seq = callSeq.current
    const talkId = talkRef.current
    const { blob, ms, peak } = await recorder.current.stop()
    if (seq !== callSeq.current || !talkId) return
    if (ms < MIN_SPEECH_MS || blob.size < 500) {
      setNotice(t('city.tooShort'))
      setTurn('ready')
      return
    }
    if (peak !== null && peak < SILENT_PEAK) {
      setNotice(t('city.silentMic'))
      setTurn('ready')
      return
    }
    setTurn('thinking')
    try {
      const r = await say(talkId, blob, ms)
      if (seq !== callSeq.current) return
      applyGame(r.game)
      setCost({ turn: r.cost, talk: r.total, game: r.spent })
      if (!r.heard) {
        setNotice(t('city.notHeard'))
        setTurn('ready')
        return
      }
      addLine({ role: 'user', text: r.heard })
      if (r.reply?.text) addLine({ role: 'agent', text: r.reply.text, cost: r.cost })
      await playReply(r.reply, seq)
      if (seq !== callSeq.current) return
      if (r.ended || r.game.status === 'won') finishTalk({ walkedAway: r.walkedAway })
    } catch (e) {
      if (seq !== callSeq.current) return
      setError(errorText(e, ui))
      if (e instanceof CityError && e.status === 410) finishTalk()
      else setTurn('ready')
    }
  }

  useEffect(() => {
    if (turn !== 'recording') {
      micRef.current?.style.removeProperty('--level')
      return
    }
    let frame = 0
    const tick = () => {
      micRef.current?.style.setProperty('--level', Math.min(1, recorder.current.level() * 8).toFixed(3))
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [turn])

  useEffect(() => {
    if (phase !== 'talking') return
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || typing(e)) return
      e.preventDefault()
      player.current.unlock()
      recorder.current.prepare()
      void press()
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || typing(e)) return
      e.preventDefault()
      void release()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  const startNew = async () => {
    const previous = gameRef.current
    const previousCharacter = character
    if (talkRef.current) finishTalk()
    setError(null)
    setNotice(null)
    setPhase('generating')
    setStoryStartedAt(Date.now())
    setCharacter(null)
    setLines([])
    setCost(null)
    currentRef.current = null
    lastSpokeRef.current = null
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
      setError(errorText(e, ui))
      setPhase('idle')
    }
  }

  const onMic = () => {
    if (phase !== 'idle') return
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
    if (phase === 'talking') finishTalk({ next: id })
    else if (phase === 'idle') void connectTo(g, id, lastSpokeRef.current)
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

  const done = allowed === true && game?.status === 'won' && phase === 'idle'
  const busy = phase === 'loading' || phase === 'generating' || phase === 'painting' || phase === 'connecting' || phase === 'walking'
  const active = game && game.status === 'active'
  const walkingTo = phase === 'walking' && walkingId ? game?.characters.find((c) => c.id === walkingId) : undefined

  const sceneOf = (id: string | null | undefined) => (id ? (game?.characters.find((c) => c.id === id)?.scene ?? null) : null)
  const shownId = phase === 'painting' ? paintingId : (character?.id ?? (active && game?.met.length === 0 ? game.startId : null))
  const choosing = !!active && phase === 'idle' && !character && (game?.met.length ?? 0) > 0
  const scene = phase === 'generating' || phase === 'walking' ? null : sceneOf(shownId)
  const sceneState = phase === 'generating' || phase === 'walking' || scene ? null : game?.characters.find((c) => c.id === shownId)?.sceneState
  const soundOn = phase === 'painting' || phase === 'connecting' || phase === 'talking' || (phase === 'idle' && !!character)
  const ambienceUrl = allowed && soundOn ? (game?.characters.find((c) => c.id === shownId)?.ambience ?? null) : null
  useAmbience(ambienceUrl, ambienceVolume, speaking)
  const showSpeaker = !!character && (phase === 'connecting' || phase === 'talking' || phase === 'idle')
  const talking = phase === 'talking'
  const micClass = !talking
    ? 'mic-btn'
    : turn === 'recording'
      ? 'mic-btn mic-listening'
      : turn === 'arming' || turn === 'thinking'
        ? 'mic-btn mic-waiting'
        : 'mic-btn mic-hold'

  return (
    <div className="city-layout">
      <main className="city">
        {game && phase !== 'generating' && (
          <Tip text={game.goalHint} className="city-goal-wrap" placement="below">
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
            {phase === 'generating' && <Progress label={t('city.inventing')} startedAt={storyStartedAt} expectedMs={storyMs} />}
            {phase !== 'generating' && sceneState?.state === 'drawing' && (
              <Progress
                label={phase === 'painting' ? t('city.drawingThenTalk') : t('city.drawing')}
                startedAt={gameAt - sceneState.elapsedMs}
                expectedMs={sceneState.expectedMs}
              />
            )}
            {phase === 'painting' && (!sceneState || sceneState.state === 'none') && <div className="city-hint city-hint-small">{t('city.preparing')}</div>}
            {phase !== 'generating' && sceneState?.state === 'queued' && <div className="city-hint city-hint-small">{t('city.queued')}</div>}
            {phase === 'walking' && <div className="city-hint">{t('city.walking')}{walkingTo ? ` ${walkingTo.name}` : ''}</div>}
            {done && (
              <div className="city-won-card">
                <div className="city-won">{t('city.won')}</div>
                <button className="primary-btn" onClick={() => void startNew()}>
                  {t('city.newTask')}
                </button>
              </div>
            )}
            {phase === 'idle' && !character && !done && (
              <div className="city-hint">
                {!allowed
                  ? t(`city.intro.${lang}` as const, { city })
                  : active
                    ? choosing
                      ? t('city.choose')
                      : t('city.first')
                    : t(`city.start.${lang}` as const, { city })}
              </div>
            )}
          </div>

          <div className="city-bottom">
            {showSpeaker && (
              <div className="city-speaker">
                <div className={speaking ? 'city-name city-name-speaking' : 'city-name'}>{character.name}</div>
                <Tip text={`${character.nameHint !== character.name ? `${character.nameHint} · ` : ''}${character.roleHint} · ${character.placeHint}`}>
                  <span className="city-role">{character.role} · {character.place}</span>
                </Tip>
                {cost && (
                  <div className="city-cost">
                    💰 {t('city.cost', { turn: cost.turn === null ? '—' : money(cost.turn), talk: money(cost.talk), game: money(cost.game) })}
                  </div>
                )}
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
                    {l.cost !== undefined && <span className="city-line-cost"> · {money(l.cost)}</span>}
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
            {!error && phase === 'connecting' && t('city.approaching')}
            {!error && talking && turn === 'ready' && t('city.holdToTalk')}
            {!error && talking && turn === 'arming' && t('city.micStarting')}
            {!error && talking && turn === 'recording' && t('city.recording')}
            {!error && talking && turn === 'thinking' && t('city.thinking', { name: character?.name ?? '' })}
            {!error && talking && turn === 'speaking' && t('city.speaking')}
            {!error && done && t('city.doneStatus')}
            {allowed === false && !signedIn && (
              <>
                {t('city.invite')}{' '}
                <button className="link-btn" onClick={onSignIn}>
                  {t('header.signIn')}
                </button>
              </>
            )}
            {allowed === false && signedIn && !needsCode && t('city.inviteOnly')}
          {allowed === false && signedIn && needsCode && (
            <form
              className="city-code"
              onSubmit={(e) => {
                e.preventDefault()
                void submitCode()
              }}
            >
              <span>{t('city.enterCode')}</span>
              <input
                className="account-input city-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="XXXX-XXXX"
                autoComplete="one-time-code"
                aria-label={t('city.codeAria')}
              />
              <button className="primary-btn" type="submit" disabled={unlocking || !code.trim()}>
                {t('city.open')}
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
                  : t('city.levelOk', { level: levelCheck.check.level })
              }
            >
              <span className={levelCheck.check.issues.length ? 'city-level city-level-warn' : 'city-level'}>
                📏{' '}
                {t('city.levelCount', {
                  who: levelCheck.who,
                  ok: levelCheck.check.total - levelCheck.check.issues.length,
                  total: levelCheck.check.total,
                  level: levelCheck.check.level,
                })}
              </span>
            </Tip>
          )}
          <div className="city-dock-row">
            <div className="city-dock-side">
              {allowed && (
                <button className="secondary-btn" onClick={toggleSubs}>
                  {subs ? t('city.subsOff') : t('city.subsOn')}
                </button>
              )}
            </div>
            <button
              ref={micRef}
              className={micClass}
              onClick={onMic}
              onPointerDown={(e) => {
                if (!talking) return
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                player.current.unlock()
                recorder.current.prepare()
                void press()
              }}
              onPointerUp={() => void release()}
              onPointerCancel={() => void release()}
              onContextMenu={(e) => e.preventDefault()}
              disabled={busy || !allowed || choosing || (talking && turn === 'thinking')}
              aria-label={talking ? t('city.holdAria') : t('city.startTalk')}
            >
              {busy || (talking && (turn === 'arming' || turn === 'thinking')) ? '…' : '🎤'}
            </button>
            <div className="city-dock-side">
              {talking && (
                <button className="secondary-btn" onClick={() => finishTalk()}>
                  {t('city.stepAway')}
                </button>
              )}
              {phase === 'idle' && active && (
                <button className="secondary-btn" onClick={() => void startNew()}>
                  {t('city.otherTask')}
                </button>
              )}
              {done && (
                <button className="secondary-btn" onClick={() => void startNew()}>
                  {t('city.newTask')}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
      {allowed && game && (
        <Notebook
          city={city}
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
