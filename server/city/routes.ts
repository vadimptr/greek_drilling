import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import type { UserRow } from '../db.ts'
import { nameKey } from '../db.ts'
import { HttpError, readBody, readJson, send } from '../http.ts'
import { issue, readCookie, verify } from '../session.ts'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { addClaude, addCost, addStt, addTts, DEFAULT_PRICES, noCost, type Cost, type Prices } from './costs.ts'
import { imageType, Timing, type SceneStore } from './images.ts'
import { ambienceKey, ambienceKeysOf, ambienceOf, type AmbienceStore } from './ambience.ts'
import { createPool, randomTime, takeFromPool } from './pool.ts'
import { ProviderError, type FactMatcher, type LevelChecker, type ScenarioGenerator, type SpeechProvider, type Talker, type Translator } from './providers.ts'
import { anyText, buildPersona, card, factsOf, isLang, LANGS, MOODS, nameOf, tellableBy, textOf, type Lang, type Level, type Persona, type TextField } from './scenario.ts'
import { settingOf } from './settings.ts'
import { say, type MessageKey } from './messages.ts'
import {
  abandonActive, addFound, addHeard, addLevelCheck, addLines, allGames, everyGame, gameCost, recentLevelNotes, type LevelCheck, linesFor, saveScenario, setMood, createGame, currentGame, findGame, finishGame, markMet, migrateCity, recentGoals,
  recordCost, recordStory, recordTalk, storiesSince, talksSince, type Game,
} from './store.ts'
import type { PoolSizes } from './pool.ts'

export interface CityDeps {
  allowedUsers: string[]
  dailyTalks: number
  dailyStories?: number
  poolSize?: number | Partial<Record<Level, number>> | PoolSizes
  poolIntervalMs?: number
  scenarios: ScenarioGenerator | null
  facts: FactMatcher | null
  translator: Translator | null
  levels?: LevelChecker | null
  speech: SpeechProvider | null
  talker: Talker | null
  prices?: Prices
  scenes: SceneStore | null
  ambience?: AmbienceStore | null
}

const LEVELS: Level[] = ['A1', 'A2', 'B1']
const MAX_LINE = 2000
const MAX_TRANSLATE = 500
const CACHE_SIZE = 1000
const MAX_AUDIO = 2 * 1024 * 1024
const MAX_TURNS = 60
const TALK_TTL_MS = 2 * 3600_000

type TalkLine = { role: 'user' | 'agent'; text: string }

interface TalkSession {
  id: string
  gameId: string
  userId: number
  characterId: string
  cameFrom: string | null
  metBefore: boolean
  previous: TalkLine[]
  lines: TalkLine[]
  speed?: number
  cost: Cost
  busy: boolean
  touched: number
}

const usd = (c: Cost) => Math.round(c.usd * 1e6) / 1e6

export function stripTags(text: string): string {
  return text.replace(/\[[^\]\n]{1,40}\]/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

export function parseAllowed(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((n) => n.trim()).filter(Boolean)
}

function notebookIds(game: Game): string[] {
  const s = game.scenario
  const subjects = factsOf(s).filter((f) => game.found.includes(f.id)).map((f) => f.about)
  return [...new Set([s.start_id, ...game.met, ...game.heard, ...subjects])]
}

function reachable(game: Game): Set<string> {
  return new Set(notebookIds(game))
}


export function score(game: Game): number {
  return factsOf(game.scenario)
    .filter((f) => game.found.includes(f.id))
    .reduce((sum, f) => sum + f.points, 0)
}

function notebook(game: Game, hint: Lang) {
  const s = game.scenario
  const facts = factsOf(s)
  const seen = new Set([s.start_id, ...game.met])
  return notebookIds(game).map((id) => {
    const c = s.characters.find((x) => x.id === id)!
    const own = facts.filter((f) => f.about === id)
    const visible = own.filter((f) => game.found.includes(f.id) || (f.initial && seen.has(id)))
    return {
      id,
      name: nameOf(s, c),
      nameHint: textOf(c, 'name', hint) ?? anyText(c, 'name', [hint]),
      gender: c.gender,
      met: game.met.includes(id),
      mood: game.moods[id] ?? 'friendly',
      moodReason: game.reasons[id] ?? '',
      facts: visible.map((f) => ({ id: f.id, text: textOf(f, 'text', hint) ?? anyText(f, 'text', [hint]), points: f.points, goal: f.goal })),
      hidden: own.filter((f) => !f.initial && !game.found.includes(f.id)).length,
    }
  })
}

function publicGame(game: Game, hint: Lang, scenes: SceneStore | null, ambience: AmbienceStore | null) {
  const s = game.scenario
  const sceneUrl = (id: string) => (scenes?.has(game.id, id) ? `/api/city/games/${game.id}/scenes/${id}` : null)
  return {
    scenesEnabled: !!scenes?.enabled,
    known: [...reachable(game)],
    notebook: notebook(game, hint),
    score: score(game),
    id: game.id,
    lang: game.lang,
    city: settingOf(game.lang).city,
    goal: textOf(s, 'goal', game.lang) ?? anyText(s, 'goal'),
    goalHint: textOf(s, 'goal', hint) ?? anyText(s, 'goal', [hint]),
    status: game.status,
    startId: s.start_id,
    met: game.met,
    characters: s.characters.map((c) => {
      const sound = ambienceKey(game.lang, ambienceOf(c))
      return {
        ...card(s, c, hint),
        scene: sceneUrl(c.id),
        sceneState: scenes ? scenes.status(game.id, c.id) : { state: 'none' },
        ambience: ambience?.has(sound) ? `/api/city/ambience/${sound}` : null,
      }
    }),
  }
}

export type Category = 'points' | 'quests' | 'facts'
const CATEGORIES: Category[] = ['points', 'quests', 'facts']
const TOP = 10

export function leaderboard(games: Game[], userId: number, nameOf: (id: number) => string) {
  const stats = new Map<number, Record<Category, number>>()
  for (const g of games) {
    const st = stats.get(g.userId) ?? { points: 0, quests: 0, facts: 0 }
    st.points += score(g)
    st.quests += g.status === 'won' ? 1 : 0
    st.facts += g.found.length
    stats.set(g.userId, st)
  }
  if (!stats.has(userId)) stats.set(userId, { points: 0, quests: 0, facts: 0 })
  const board = (cat: Category) => {
    const sorted = [...stats.entries()].sort((a, b) => b[1][cat] - a[1][cat] || (a[0] === userId ? -1 : b[0] === userId ? 1 : 0))
    const rows = sorted.map(([id, st], i) => ({
      rank: sorted.findIndex(([, x]) => x[cat] === st[cat]) + 1,
      value: st[cat],
      you: id === userId,
      name: id === userId ? nameOf(id) : null,
      index: i,
    }))
    const mine = rows.find((r) => r.you)!
    const shown = rows.slice(0, TOP)
    return {
      category: cat,
      players: rows.length,
      rows: (mine.index < TOP ? shown : [...shown, mine]).map(({ index: _i, ...r }) => r),
    }
  }
  return CATEGORIES.map(board)
}

export const CITY_COOKIE = 'gd_city'
const UNLOCK_MAX_AGE = 180 * 24 * 60 * 60
const UNLOCK_ATTEMPTS = 6
const UNLOCK_WINDOW_MS = 10 * 60_000

export function parseAccess(entries: string[]): Map<string, string> {
  const access = new Map<string, string>()
  for (const entry of entries) {
    const at = entry.indexOf(':')
    const name = (at < 0 ? entry : entry.slice(0, at)).trim()
    if (name) access.set(nameKey(name), at < 0 ? '' : entry.slice(at + 1).trim())
  }
  return access
}

const sameCode = (a: string, b: string) => {
  const x = Buffer.from(a.trim().toUpperCase())
  const y = Buffer.from(b.trim().toUpperCase())
  return x.length === y.length && timingSafeEqual(x, y)
}

export function createCity(db: DatabaseSync, deps: CityDeps, secret = 'city') {
  migrateCity(db)
  const access = parseAccess(deps.allowedUsers)
  const citySecret = `${secret}:city`
  const listed = (user: UserRow | undefined) => !!user && access.has(nameKey(user.name))
  const needsCode = (user: UserRow) => !!access.get(nameKey(user.name))
  const isAllowed = (user: UserRow | undefined, req: IncomingMessage) =>
    !!user && listed(user) && (!needsCode(user) || verify(citySecret, readCookie(req.headers.cookie, CITY_COOKIE)) === user.id)
  const attempts = new Map<number, number[]>()

  const hintOf = (req: IncomingMessage): Lang => {
    const v = req.headers['x-city-hint']
    return isLang(v) ? v : 'ru'
  }
  const langOfReq = (req: IncomingMessage): Lang => {
    const v = req.headers['x-city-lang']
    return isLang(v) ? v : 'el'
  }
  const fail = (req: IncomingMessage, status: number, key: MessageKey): never => {
    throw new HttpError(status, say(hintOf(req), key))
  }

  const requireAllowed = (user: UserRow | undefined, req: IncomingMessage): UserRow => {
    if (!user) fail(req, 401, 'signIn')
    if (!isAllowed(user, req)) fail(req, 403, listed(user) ? 'needCode' : 'closed')
    return user!
  }

  const loadGame = (req: IncomingMessage, user: UserRow, id: string): Game => {
    const game = findGame(db, user.id, id)
    if (!game) fail(req, 404, 'noGame')
    return game!
  }

  const providerFailure = (req: IncomingMessage) => (e: unknown): never => {
    console.error(e)
    return fail(req, 502, e instanceof ProviderError ? 'aiDown' : 'aiError')
  }

  const gameRoute = /^\/api\/city\/games\/([A-Za-z0-9_-]{1,32})\/(talk|scene)$/
  const talkRoute = /^\/api\/city\/talks\/([A-Za-z0-9_-]{8,32})\/(say|leave)$/
  const prices = deps.prices ?? DEFAULT_PRICES
  const talks = new Map<string, TalkSession>()

  const translations = new Map<string, string>()
  const translate = async (text: string, to: Lang, from?: Lang): Promise<string> => {
    const key = `${to}:${text}`
    const cached = translations.get(key)
    if (cached !== undefined) return cached
    const done = await deps.translator!.translate(text, to, from)
    if (translations.size >= CACHE_SIZE) translations.delete(translations.keys().next().value!)
    translations.set(key, done)
    return done
  }

  const storyTiming = new Timing(40_000)
  const pool = createPool(db, { scenarios: deps.scenarios, scenes: deps.scenes, ambience: deps.ambience, size: deps.poolSize ?? 0 })
  if (deps.poolIntervalMs) {
    const timer = setInterval(() => void pool.refill(), deps.poolIntervalMs)
    timer.unref()
    setTimeout(() => void pool.refill(), 5_000).unref()
  }
  const filled = new Set<string>()
  const ensureTexts = async (game: Game, hint: Lang) => {
    const t = deps.translator
    const key = `${game.id}:${hint}`
    if (!t || filled.has(key)) return
    const s = game.scenario
    const wanted: { o: object; field: TextField; lang: Lang }[] = [
      { o: s, field: 'goal', lang: game.lang },
      { o: s, field: 'goal', lang: hint },
      ...s.characters.flatMap((c) =>
        (['name', 'role', 'place'] as TextField[]).flatMap((field) => [
          { o: c, field, lang: game.lang },
          { o: c, field, lang: hint },
        ]),
      ),
      ...factsOf(s).map((f) => ({ o: f, field: 'text' as TextField, lang: hint })),
    ]
    const missing = wanted.filter((w) => !textOf(w.o, w.field, w.lang))
    filled.add(key)
    if (!missing.length) return
    try {
      for (const lang of LANGS) {
        const part = missing.filter((m) => m.lang === lang)
        if (!part.length) continue
        const sources = part.map((m) => (m.field === 'text' ? anyText(m.o, 'text', ['ru', 'en']) || ((m.o as { detail?: string }).detail ?? '') : anyText(m.o, m.field)))
        const done = await t.translateMany(sources, lang)
        part.forEach((m, i) => {
          ;(m.o as Record<string, unknown>)[`${m.field}_${m.lang}`] = done[i]
        })
      }
      saveScenario(db, game)
    } catch (e) {
      filled.delete(key)
      console.error(e)
    }
  }

  const totalScore = (userId: number, lang: Lang) => allGames(db, userId, lang).reduce((sum, g) => sum + score(g), 0)
  const view = (game: Game, hint: Lang) => ({ ...publicGame(game, hint, deps.scenes, deps.ambience ?? null), total: totalScore(game.userId, game.lang) })
  const sceneRoute = /^\/api\/city\/games\/([A-Za-z0-9_-]{1,32})\/scenes\/([a-z0-9_-]{1,40})$/

  const discover = (game: Game, speaker: string, ids: string[]) => {
    const allowedIds = new Set(tellableBy(game.scenario, speaker).map((f) => f.id))
    addFound(db, game, ids.filter((id) => allowedIds.has(id)))
    const goals = factsOf(game.scenario).filter((f) => f.goal)
    if (game.status === 'active' && goals.length && goals.every((f) => game.found.includes(f.id))) finishGame(db, game)
  }

  const personaFor = (game: Game, session: TalkSession, hint: Lang): Persona =>
    buildPersona(game.scenario, session.characterId, game.level, {
      met: session.metBefore ? game.met : game.met.filter((id) => id !== session.characterId),
      cameFrom: session.cameFrom,
      mood: game.moods[session.characterId] ?? 'friendly',
      previous: session.previous,
      levelNotes: recentLevelNotes(db, game, 6),
      hint,
    })

  const speakLine = async (persona: Persona, session: TalkSession, raw: string, cost: Cost) => {
    const text = stripTags(raw)
    if (!text) return { text, audio: null as string | null }
    const spoken = await deps.speech!.speak(text, persona.voice, session.speed)
    addTts(cost, prices, spoken.chars)
    return { text, audio: spoken.audio.toString('base64') }
  }

  const sayTurn = async (game: Game, session: TalkSession, audio: Buffer, type: string, declaredSeconds: number, hint: Lang) => {
    const cost = noCost()
    const heard = await deps.speech!.transcribe(audio, type, game.lang)
    addStt(cost, prices, Math.max(declaredSeconds, heard.seconds))
    const said = stripTags(heard.text).slice(0, MAX_LINE)
    if (!said || game.status !== 'active') {
      addCost(session.cost, cost)
      recordCost(db, game, session.characterId, 'turn', cost)
      return { heard: said, reply: null, ended: false, walkedAway: false, cost: usd(cost), total: usd(session.cost), spent: gameCost(db, game) }
    }
    session.lines.push({ role: 'user', text: said })
    const answer = await deps.talker!.reply(personaFor(game, session, hint).systemPrompt, session.lines)
    answer.usage.forEach((u) => addClaude(cost, prices, u))
    let ended = false
    for (const tool of answer.tools) {
      const arg = (k: string) => (typeof tool.input[k] === 'string' ? (tool.input[k] as string) : '')
      if (tool.name === 'reveal_fact') discover(game, session.characterId, [arg('fact_id')])
      if (tool.name === 'introduce' && arg('character_id') !== session.characterId && game.scenario.characters.some((c) => c.id === arg('character_id')))
        addHeard(db, game, [arg('character_id')])
      if (tool.name === 'set_mood') {
        const mood = MOODS.find((x) => x === arg('mood'))
        if (mood) setMood(db, game, session.characterId, mood, arg('reason').trim().slice(0, 120))
      }
      if (tool.name === 'goal_completed' && session.characterId === game.scenario.solver_id && game.status === 'active') finishGame(db, game)
      if (tool.name === 'end_call') ended = true
    }
    const persona = personaFor(game, session, hint)
    const reply = await speakLine(persona, session, answer.text, cost)
    const fresh: TalkLine[] = [{ role: 'user', text: said }]
    if (reply.text) {
      session.lines.push({ role: 'agent', text: reply.text })
      fresh.push({ role: 'agent', text: reply.text })
    }
    addLines(db, game, session.characterId, fresh)
    addCost(session.cost, cost)
    recordCost(db, game, session.characterId, 'turn', cost)
    const walkedAway = ended && game.moods[session.characterId] === 'angry'
    return { heard: said, reply: { ...reply, cost: usd(cost) }, ended, walkedAway, cost: usd(cost), total: usd(session.cost), spent: gameCost(db, game) }
  }

  const review = async (game: Game, session: TalkSession, hint: Lang) => {
    const cost = noCost()
    const meter = (u: Parameters<typeof addClaude>[2]) => addClaude(cost, prices, u)
    const lines = session.lines
    const character = game.scenario.characters.find((c) => c.id === session.characterId)!
    const open = tellableBy(game.scenario, session.characterId).filter((f) => !game.found.includes(f.id))
    const agentLines = lines.filter((l) => l.role === 'agent').map((l) => l.text)
    const spoke = lines.some((l) => l.role === 'user')
    const inBook = new Set(notebookIds(game))
    const strangers = game.scenario.characters.filter((c) => c.id !== session.characterId && !inBook.has(c.id))
    const matching =
      deps.facts && spoke && (open.length || strangers.length) && agentLines.length
        ? deps.facts
            .match(
              nameOf(game.scenario, character),
              lines,
              open.map((f) => ({ id: f.id, text: f.detail ?? anyText(f, 'text', ['en']) })),
              strangers.map((c) => ({ id: c.id, name: `${nameOf(game.scenario, c)} (${textOf(c, 'role', 'en') ?? anyText(c, 'role')})` })),
              game.lang,
              meter,
            )
            .then((found) => {
              discover(game, session.characterId, found.facts)
              addHeard(db, game, found.people)
            })
            .catch((e) => console.error(e))
        : Promise.resolve()
    const checking: Promise<LevelCheck | null> =
      deps.levels && spoke && agentLines.length
        ? deps.levels
            .check(game.level, agentLines, game.lang, hint, meter)
            .then((issues) => {
              const check = {
                level: game.level,
                total: agentLines.length,
                issues: issues.map((i) => ({ text: agentLines[i.index], reason: i.reason, note: i.note_en })),
              }
              addLevelCheck(db, game, session.characterId, check)
              return check
            })
            .catch((e) => {
              console.error(e)
              return null
            })
        : Promise.resolve(null)
    const [, check] = await Promise.all([matching, checking])
    addCost(session.cost, cost)
    if (cost.usd > 0) recordCost(db, game, session.characterId, 'review', cost)
    return { check: check && { ...check, issues: check.issues.map(({ note: _n, ...i }) => i) }, cost }
  }

  return async function handle(req: IncomingMessage, res: ServerResponse, path: string, user: UserRow | undefined): Promise<boolean> {
    if (!path.startsWith('/api/city')) return false
    const method = req.method ?? 'GET'

    if (method === 'GET' && path === '/api/city') {
      const lang = langOfReq(req)
      send(res, 200, {
        allowed: isAllowed(user, req),
        needsCode: !!user && listed(user) && !isAllowed(user, req),
        city: settingOf(lang).city,
        total: isAllowed(user, req) ? totalScore(user!.id, lang) : 0,
        storyMs: storyTiming.ms,
      })
      return true
    }

    if (method === 'POST' && path === '/api/city/unlock') {
      if (!user) return fail(req, 401, 'signIn')
      if (!listed(user)) return fail(req, 403, 'closed')
      const now = Date.now()
      const recent = (attempts.get(user.id) ?? []).filter((t) => now - t < UNLOCK_WINDOW_MS)
      if (recent.length >= UNLOCK_ATTEMPTS) fail(req, 429, 'tooManyCodes')
      recent.push(now)
      attempts.set(user.id, recent)
      const body = await readJson(req)
      const code = typeof body.code === 'string' ? body.code : ''
      const expected = access.get(nameKey(user.name)) ?? ''
      if (expected && !sameCode(code, expected)) fail(req, 403, 'wrongCode')
      attempts.delete(user.id)
      const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''
      send(res, 204, undefined, {
        'Set-Cookie': `${CITY_COOKIE}=${issue(citySecret, user.id)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${UNLOCK_MAX_AGE}${secure}`,
      })
      return true
    }

    if (method === 'GET' && path === '/api/city/leaderboard') {
      const u = requireAllowed(user, req)
      const names = new Map<number, string>()
      const nameOf = (id: number) => {
        if (!names.has(id)) names.set(id, (db.prepare('SELECT name FROM users WHERE id = ?').get(id) as { name: string } | undefined)?.name ?? '')
        return names.get(id)!
      }
      send(res, 200, { boards: leaderboard(everyGame(db, langOfReq(req)), u.id, nameOf) })
      return true
    }

    if (method === 'GET' && path === '/api/city/games/current') {
      const u = requireAllowed(user, req)
      const game = currentGame(db, u.id, langOfReq(req))
      if (game) {
        await ensureTexts(game, hintOf(req))
        void deps.scenes?.ensureAll(game.id, game.scenario)
        void deps.ambience?.ensureMany(ambienceKeysOf(game.scenario))
      }
      send(res, 200, { game: game ? view(game, hintOf(req)) : null })
      return true
    }

    if (method === 'POST' && path === '/api/city/translate') {
      requireAllowed(user, req)
      if (!deps.translator) fail(req, 503, 'noTranslator')
      const body = await readJson(req)
      const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TRANSLATE) : ''
      if (!text) fail(req, 400, 'emptyText')
      const to = isLang(body.to) ? body.to : hintOf(req)
      const from = isLang(body.from) ? body.from : undefined
      send(res, 200, { text: await translate(text, to, from).catch(providerFailure(req)) })
      return true
    }

    if (method === 'POST' && path === '/api/city/games') {
      const u = requireAllowed(user, req)
      if (!deps.scenarios) fail(req, 503, 'noGenerator')
      const body = await readJson(req)
      const level = LEVELS.find((l) => l === body.level) ?? 'A2'
      const lang = isLang(body.lang) ? body.lang : langOfReq(req)
      if (storiesSince(db, u.id, new Date(Date.now() - 24 * 3600_000)) >= (deps.dailyStories ?? 15)) fail(req, 429, 'storyLimit')
      const pooled = takeFromPool(db, level, lang)
      let scenario = pooled?.scenario
      if (!scenario) {
        const startedAt = Date.now()
        scenario = await deps.scenarios!.generate(level, recentGoals(db, u.id, lang), randomTime(), lang).catch(providerFailure(req))
        storyTiming.record(Date.now() - startedAt)
      }
      scenario.lang = lang
      abandonActive(db, u.id, lang)
      const game = createGame(db, u.id, level, scenario, pooled?.id)
      void pool.refill()
      recordStory(db, u.id)
      await ensureTexts(game, hintOf(req))
      void deps.scenes?.ensureAll(game.id, scenario)
      void deps.ambience?.ensureMany(ambienceKeysOf(scenario))
      send(res, 201, { game: view(game, hintOf(req)) })
      return true
    }

    const am = /^\/api\/city\/ambience\/([a-z_]{1,24})$/.exec(path)
    if (method === 'GET' && am) {
      requireAllowed(user, req)
      const mp3 = deps.ambience?.read(am[1])
      if (!mp3) return fail(req, 404, 'noSound')
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': mp3.length, 'Cache-Control': 'private, max-age=604800' })
      res.end(mp3)
      return true
    }

    const sm = sceneRoute.exec(path)
    if (method === 'GET' && sm) {
      const u = requireAllowed(user, req)
      const game = loadGame(req, u, sm[1])
      const png = deps.scenes?.read(game.id, sm[2])
      if (!png) return fail(req, 404, 'noImage')
      res.writeHead(200, { 'Content-Type': imageType(png), 'Content-Length': png.length, 'Cache-Control': 'private, max-age=86400' })
      res.end(png)
      return true
    }

    const tm = talkRoute.exec(path)
    if (method === 'POST' && tm) {
      const u = requireAllowed(user, req)
      const now = Date.now()
      for (const [id, t] of talks) if (now - t.touched > TALK_TTL_MS) talks.delete(id)
      const session = talks.get(tm[1])
      if (!session || session.userId !== u.id) return fail(req, 410, 'talkGone')
      const game = loadGame(req, u, session!.gameId)
      const hint = hintOf(req)
      session!.touched = now
      if (tm[2] === 'leave') {
        talks.delete(session!.id)
        const { check, cost } = await review(game, session!, hint)
        send(res, 200, { game: view(game, hint), check, cost: usd(cost), total: usd(session!.cost), spent: gameCost(db, game) })
        return true
      }
      if (session!.busy) return fail(req, 409, 'talkBusy')
      if (session!.lines.length >= MAX_TURNS * 2) return fail(req, 429, 'talkLimit')
      const type = String(req.headers['content-type'] ?? '').split(';')[0].trim()
      if (!type.startsWith('audio/') && type !== 'video/webm') return fail(req, 415, 'noSpeech')
      const audio = await readBody(req, MAX_AUDIO)
      if (audio.length < 200) return fail(req, 400, 'noSpeech')
      const declared = Number(req.headers['x-audio-ms'])
      session!.busy = true
      try {
        const turn = await sayTurn(game, session!, audio, type, Number.isFinite(declared) ? Math.min(60, Math.max(0, declared / 1000)) : 0, hint).catch(providerFailure(req))
        send(res, 200, { ...turn, game: view(game, hint) })
      } finally {
        session!.busy = false
      }
      return true
    }

    const m = gameRoute.exec(path)
    if (method !== 'POST' || !m) return false
    const u = requireAllowed(user, req)
    const game = loadGame(req, u, m[1])
    const hint = hintOf(req)
    const body = await readJson(req)
    const characterId = typeof body.characterId === 'string' ? body.characterId : ''
    const found = game.scenario.characters.find((c) => c.id === characterId)
    if (!found) return fail(req, 400, 'noResident')
    const character = found!

    if (m[2] === 'scene') {
      void deps.scenes?.ensure(game.id, character, game.scenario.time_of_day, game.lang)
      send(res, 200, { game: view(game, hint) })
      return true
    }

    if (game.status !== 'active') fail(req, 409, 'done')
    if (!deps.speech || !deps.talker) fail(req, 503, 'noVoice')
    if (!reachable(game).has(characterId)) fail(req, 409, 'unknownPlace')
    if (talksSince(db, u.id, new Date(Date.now() - 24 * 3600_000)) >= deps.dailyTalks) fail(req, 429, 'talkLimit')
    for (const [id, t] of talks) if (t.userId === u.id) talks.delete(id)
    const session: TalkSession = {
      id: randomBytes(12).toString('base64url'),
      gameId: game.id,
      userId: u.id,
      characterId,
      cameFrom: typeof body.from === 'string' && game.met.includes(body.from) ? body.from : null,
      metBefore: game.met.includes(characterId),
      previous: linesFor(db, game, characterId, 16) as TalkLine[],
      lines: [],
      speed: typeof body.speed === 'number' && Number.isFinite(body.speed) ? Math.min(1.2, Math.max(0.7, body.speed)) : undefined,
      cost: noCost(),
      busy: false,
      touched: Date.now(),
    }
    const persona = personaFor(game, session, hint)
    const cost = noCost()
    const greeting = await speakLine(persona, session, persona.firstMessage, cost).catch(providerFailure(req))
    recordTalk(db, game, characterId, 'turns')
    markMet(db, game, characterId)
    void deps.scenes?.ensure(game.id, character, game.scenario.time_of_day, game.lang)
    talks.set(session.id, session)
    session.lines.push({ role: 'agent', text: greeting.text })
    addLines(db, game, characterId, [{ role: 'agent', text: greeting.text }])
    addCost(session.cost, cost)
    recordCost(db, game, characterId, 'greet', cost)
    send(res, 200, {
      character: card(game.scenario, character, hint),
      talkId: session.id,
      reply: { ...greeting, cost: usd(cost) },
      total: usd(session.cost),
      spent: gameCost(db, game),
      game: view(game, hint),
    })
    return true
  }
}
