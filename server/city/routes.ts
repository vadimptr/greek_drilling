import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import type { UserRow } from '../db.ts'
import { nameKey } from '../db.ts'
import { HttpError, readJson, send } from '../http.ts'
import { issue, readCookie, verify } from '../session.ts'
import { timingSafeEqual } from 'node:crypto'
import { imageType, Timing, type SceneStore } from './images.ts'
import { ambienceKey, ambienceKeysOf, ambienceOf, type AmbienceStore } from './ambience.ts'
import { createPool, randomTime, takeFromPool } from './pool.ts'
import { ProviderError, type FactMatcher, type LevelChecker, type ScenarioGenerator, type Translator, type VoiceProvider } from './providers.ts'
import { anyText, buildPersona, card, factsOf, isLang, LANGS, MOODS, nameOf, tellableBy, textOf, type Lang, type Level, type Mood, type TextField } from './scenario.ts'
import { settingOf } from './settings.ts'
import { say, type MessageKey } from './messages.ts'
import {
  abandonActive, addFound, addHeard, addLevelCheck, addLines, allGames, everyGame, recentLevelNotes, type LevelCheck, linesFor, saveScenario, setMood, createGame, currentGame, findGame, finishGame, markMet, migrateCity, recentGoals,
  recordStory, recordTalk, storiesSince, talksSince, type Game,
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
  voice: VoiceProvider | null
  scenes: SceneStore | null
  ambience?: AmbienceStore | null
}

const LEVELS: Level[] = ['A1', 'A2', 'B1']
const MAX_LINES = 200
const MAX_LINE = 2000
const MAX_TRANSLATE = 500
const CACHE_SIZE = 1000

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

  const gameRoute = /^\/api\/city\/games\/([A-Za-z0-9_-]{1,32})\/(talk|lines|facts|mood|scene|introduce|complete)$/

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

    if (m[2] === 'talk') {
      if (game.status !== 'active') fail(req, 409, 'done')
      if (!deps.voice) fail(req, 503, 'noVoice')
      if (!reachable(game).has(characterId)) fail(req, 409, 'unknownPlace')
      const resume = body.resume === 'voice' || body.resume === 'tap' ? body.resume : undefined
      if (resume && !game.met.includes(characterId)) fail(req, 409, 'notMet')
      if (!resume && talksSince(db, u.id, new Date(Date.now() - 24 * 3600_000)) >= deps.dailyTalks) fail(req, 429, 'talkLimit')
      const from = typeof body.from === 'string' && game.met.includes(body.from) ? body.from : null
      const persona = buildPersona(game.scenario, characterId, game.level, {
        met: game.met,
        cameFrom: from,
        mood: game.moods[characterId] ?? 'friendly',
        previous: linesFor(db, game, characterId, 16),
        levelNotes: recentLevelNotes(db, game, 6),
        resume,
        hint,
      })
      if (typeof body.speed === 'number' && Number.isFinite(body.speed)) persona.speed = Math.min(1.2, Math.max(0.7, body.speed))
      const session = await deps.voice!.open(persona).catch(providerFailure(req))
      if (!resume) recordTalk(db, game, characterId, deps.voice!.id)
      void deps.scenes?.ensure(game.id, character, game.scenario.time_of_day, game.lang)
      markMet(db, game, characterId)
      send(res, 200, { character: card(game.scenario, character, hint), session, game: view(game, hint) })
      return true
    }

    if (m[2] === 'lines') {
      const raw = Array.isArray(body.lines) ? body.lines.slice(0, MAX_LINES) : []
      const lines = raw
        .filter((l): l is { role: string; text: string } => typeof l?.text === 'string' && (l.role === 'user' || l.role === 'agent'))
        .map((l) => ({ role: l.role, text: stripTags(l.text).slice(0, MAX_LINE) }))
        .filter((l) => l.text)
      addLines(db, game, characterId, lines)
      const open = tellableBy(game.scenario, characterId).filter((f) => !game.found.includes(f.id))
      const agentLines = lines.filter((l) => l.role === 'agent').map((l) => l.text)
      const inBook = new Set(notebookIds(game))
      const strangers = game.scenario.characters.filter((c) => c.id !== characterId && !inBook.has(c.id))
      const matching =
        deps.facts && (open.length || strangers.length) && agentLines.length
          ? deps.facts
              .match(
                nameOf(game.scenario, character),
                lines,
                open.map((f) => ({ id: f.id, text: f.detail ?? anyText(f, 'text', ['en']) })),
                strangers.map((c) => ({ id: c.id, name: `${nameOf(game.scenario, c)} (${textOf(c, 'role', 'en') ?? anyText(c, 'role')})` })),
                game.lang,
              )
              .then((found) => {
                discover(game, characterId, found.facts)
                addHeard(db, game, found.people)
              })
              .catch((e) => console.error(e))
          : Promise.resolve()
      const checking: Promise<LevelCheck | null> =
        deps.levels && agentLines.length
          ? deps.levels
              .check(game.level, agentLines, game.lang, hint)
              .then((issues) => {
                const check = {
                  level: game.level,
                  total: agentLines.length,
                  issues: issues.map((i) => ({ text: agentLines[i.index], reason: i.reason, note: i.note_en })),
                }
                addLevelCheck(db, game, characterId, check)
                return check
              })
              .catch((e) => {
                console.error(e)
                return null
              })
          : Promise.resolve(null)
      const [, check] = await Promise.all([matching, checking])
      send(res, 200, { game: view(game, hint), check: check && { ...check, issues: check.issues.map(({ note: _n, ...i }) => i) } })
      return true
    }

    if (m[2] === 'introduce') {
      if (!game.met.includes(characterId)) fail(req, 409, 'notMet')
      const target = typeof body.target === 'string' ? body.target : ''
      if (target !== characterId && game.scenario.characters.some((c) => c.id === target)) addHeard(db, game, [target])
      send(res, 200, { game: view(game, hint) })
      return true
    }

    if (m[2] === 'scene') {
      void deps.scenes?.ensure(game.id, character, game.scenario.time_of_day, game.lang)
      send(res, 200, { game: view(game, hint) })
      return true
    }

    if (m[2] === 'mood') {
      if (!game.met.includes(characterId)) fail(req, 409, 'notMet')
      const mood = MOODS.find((x) => x === body.mood)
      if (!mood) fail(req, 400, 'unknownMood')
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 120) : ''
      setMood(db, game, characterId, mood as Mood, reason)
      send(res, 200, { game: view(game, hint) })
      return true
    }

    if (m[2] === 'facts') {
      if (!game.met.includes(characterId)) fail(req, 409, 'notMet')
      const ids = Array.isArray(body.factIds) ? body.factIds.filter((x): x is string => typeof x === 'string').slice(0, 20) : []
      discover(game, characterId, ids)
      send(res, 200, { game: view(game, hint) })
      return true
    }

    if (characterId !== game.scenario.solver_id || !game.met.includes(characterId)) fail(req, 409, 'cannotFinish')
    if (game.status === 'active') finishGame(db, game)
    send(res, 200, { game: view(game, hint) })
    return true
  }
}
