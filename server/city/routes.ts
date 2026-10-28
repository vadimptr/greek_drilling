import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import type { UserRow } from '../db.ts'
import { nameKey } from '../db.ts'
import { HttpError, readJson, send } from '../http.ts'
import { ProviderError, type FactMatcher, type ScenarioGenerator, type Translator, type VoiceProvider } from './providers.ts'
import { buildPersona, card, CITY_NAME, factsOf, MOODS, tellableBy, type Level, type Mood, type Scenario } from './scenario.ts'
import {
  abandonActive, addFound, addHeard, addLines, allGames, linesFor, setMood, createGame, currentGame, findGame, finishGame, markMet, migrateCity, recentGoals,
  recordTalk, talksSince, type Game,
} from './store.ts'

export interface CityDeps {
  allowedUsers: string[]
  dailyTalks: number
  scenarios: ScenarioGenerator | null
  facts: FactMatcher | null
  translator: Translator | null
  voice: VoiceProvider | null
}

const LEVELS: Level[] = ['A1', 'A2', 'B1']
const MAX_LINES = 200
const MAX_LINE = 2000
const MAX_TRANSLATE = 500
const CACHE_SIZE = 1000

export function parseAllowed(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((n) => n.trim()).filter(Boolean)
}

function notebookIds(game: Game): string[] {
  const s = game.scenario
  const subjects = factsOf(s).filter((f) => game.found.includes(f.id)).map((f) => f.about)
  return [...new Set([s.start_id, ...game.met, ...game.heard, ...subjects])]
}

function reachable(game: Game): Set<string> {
  const ids = new Set(notebookIds(game))
  for (const id of game.met) game.scenario.characters.find((c) => c.id === id)?.refers_to.forEach((r) => ids.add(r))
  return ids
}

const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function mentioned(s: Scenario, text: string): string[] {
  const t = fold(text)
  return s.characters
    .filter((c) => {
      const name = fold(c.name_el)
      const stem = name.slice(0, Math.max(4, name.length - 2))
      return new RegExp(`(^|[^\\p{L}])${stem}`, 'u').test(t)
    })
    .map((c) => c.id)
}

export function score(game: Game): number {
  return factsOf(game.scenario)
    .filter((f) => game.found.includes(f.id))
    .reduce((sum, f) => sum + f.points, 0)
}

function notebook(game: Game) {
  const s = game.scenario
  const facts = factsOf(s)
  const seen = new Set([s.start_id, ...game.met])
  return notebookIds(game).map((id) => {
    const c = s.characters.find((x) => x.id === id)!
    const own = facts.filter((f) => f.about === id)
    const visible = own.filter((f) => game.found.includes(f.id) || (f.initial && seen.has(id)))
    return {
      id,
      name: c.name_el,
      nameRu: c.name_ru,
      gender: c.gender,
      met: game.met.includes(id),
      mood: game.moods[id] ?? 'friendly',
      moodReason: game.reasons[id] ?? '',
      facts: visible.map((f) => ({ id: f.id, text: f.text_ru, points: f.points, goal: f.goal })),
      hidden: own.filter((f) => !f.initial && !game.found.includes(f.id)).length,
    }
  })
}

function publicGame(game: Game) {
  const s = game.scenario
  return {
    known: [...reachable(game)],
    notebook: notebook(game),
    score: score(game),
    id: game.id,
    city: CITY_NAME,
    goal: s.goal_el ?? s.goal_ru,
    goalRu: s.goal_ru,
    status: game.status,
    startId: s.start_id,
    met: game.met,
    characters: s.characters.map(card),
  }
}

export function createCity(db: DatabaseSync, deps: CityDeps) {
  migrateCity(db)
  const allowed = new Set(deps.allowedUsers.map(nameKey))
  const isAllowed = (user: UserRow | undefined) => !!user && allowed.has(nameKey(user.name))

  const requireAllowed = (user: UserRow | undefined): UserRow => {
    if (!user) throw new HttpError(401, 'Нужно войти')
    if (!isAllowed(user)) throw new HttpError(403, 'Город пока закрыт для этого аккаунта')
    return user
  }

  const loadGame = (user: UserRow, id: string): Game => {
    const game = findGame(db, user.id, id)
    if (!game) throw new HttpError(404, 'Игра не найдена')
    return game
  }

  const providerFailure = (e: unknown): never => {
    console.error(e)
    throw new HttpError(502, e instanceof ProviderError ? 'Сервис ИИ сейчас недоступен, попробуй ещё раз' : 'Ошибка сервиса ИИ')
  }

  const gameRoute = /^\/api\/city\/games\/([A-Za-z0-9_-]{1,32})\/(talk|lines|facts|mood|complete)$/

  const translations = new Map<string, string>()
  const translate = async (text: string): Promise<string> => {
    const cached = translations.get(text)
    if (cached !== undefined) return cached
    const ru = await deps.translator!.toRussian(text)
    if (translations.size >= CACHE_SIZE) translations.delete(translations.keys().next().value!)
    translations.set(text, ru)
    return ru
  }

  const totalScore = (userId: number) => allGames(db, userId).reduce((sum, g) => sum + score(g), 0)
  const view = (game: Game) => ({ ...publicGame(game), total: totalScore(game.userId) })

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
      send(res, 200, { allowed: isAllowed(user), city: CITY_NAME, total: isAllowed(user) ? totalScore(user!.id) : 0 })
      return true
    }

    if (method === 'GET' && path === '/api/city/games/current') {
      const u = requireAllowed(user)
      const game = currentGame(db, u.id)
      send(res, 200, { game: game ? view(game) : null })
      return true
    }

    if (method === 'POST' && path === '/api/city/translate') {
      requireAllowed(user)
      if (!deps.translator) throw new HttpError(503, 'Перевод не настроен')
      const body = await readJson(req)
      const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TRANSLATE) : ''
      if (!text) throw new HttpError(400, 'Пустой текст')
      send(res, 200, { ru: await translate(text).catch(providerFailure) })
      return true
    }

    if (method === 'POST' && path === '/api/city/games') {
      const u = requireAllowed(user)
      if (!deps.scenarios) throw new HttpError(503, 'Генератор сценариев не настроен')
      const body = await readJson(req)
      const level = LEVELS.find((l) => l === body.level) ?? 'A2'
      const scenario = await deps.scenarios.generate(level, recentGoals(db, u.id)).catch(providerFailure)
      abandonActive(db, u.id)
      const game = createGame(db, u.id, level, scenario)
      send(res, 201, { game: view(game) })
      return true
    }

    const m = gameRoute.exec(path)
    if (method !== 'POST' || !m) return false
    const u = requireAllowed(user)
    const game = loadGame(u, m[1])
    const body = await readJson(req)
    const characterId = typeof body.characterId === 'string' ? body.characterId : ''
    const character = game.scenario.characters.find((c) => c.id === characterId)
    if (!character) throw new HttpError(400, 'Нет такого жителя')

    if (m[2] === 'talk') {
      if (game.status !== 'active') throw new HttpError(409, 'Задание уже выполнено')
      if (!deps.voice) throw new HttpError(503, 'Голосовой сервис не настроен')
      if (!reachable(game).has(characterId)) throw new HttpError(409, 'Ты ещё не знаешь, где найти этого жителя')
      if (talksSince(db, u.id, new Date(Date.now() - 24 * 3600_000)) >= deps.dailyTalks) {
        throw new HttpError(429, 'На сегодня разговоров достаточно, город отдыхает до завтра')
      }
      const from = typeof body.from === 'string' && game.met.includes(body.from) ? body.from : null
      const persona = buildPersona(game.scenario, characterId, game.level, {
        met: game.met,
        cameFrom: from,
        mood: game.moods[characterId] ?? 'friendly',
        previous: linesFor(db, game, characterId, 16),
      })
      if (typeof body.speed === 'number' && Number.isFinite(body.speed)) persona.speed = Math.min(1.2, Math.max(0.7, body.speed))
      const session = await deps.voice.open(persona).catch(providerFailure)
      recordTalk(db, game, characterId, deps.voice.id)
      markMet(db, game, characterId)
      send(res, 200, { character: card(character), session, game: view(game) })
      return true
    }

    if (m[2] === 'lines') {
      const raw = Array.isArray(body.lines) ? body.lines.slice(0, MAX_LINES) : []
      const lines = raw
        .filter((l): l is { role: string; text: string } => typeof l?.text === 'string' && (l.role === 'user' || l.role === 'agent'))
        .map((l) => ({ role: l.role, text: l.text.slice(0, MAX_LINE) }))
      addLines(db, game, characterId, lines)
      const said = lines.filter((l) => l.role === 'agent').map((l) => l.text).join(' ')
      addHeard(db, game, mentioned(game.scenario, said).filter((id) => id !== characterId))
      const open = tellableBy(game.scenario, characterId).filter((f) => !game.found.includes(f.id))
      if (deps.facts && open.length && lines.some((l) => l.role === 'agent')) {
        try {
          const ids = await deps.facts.match(character.name_el, lines, open.map((f) => ({ id: f.id, text: f.text_en })))
          discover(game, characterId, ids)
        } catch (e) {
          console.error(e)
        }
      }
      send(res, 200, { game: view(game) })
      return true
    }

    if (m[2] === 'mood') {
      if (!game.met.includes(characterId)) throw new HttpError(409, 'С этим жителем ты ещё не говорил')
      const mood = MOODS.find((x) => x === body.mood)
      if (!mood) throw new HttpError(400, 'Неизвестное настроение')
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 120) : ''
      setMood(db, game, characterId, mood as Mood, reason)
      send(res, 200, { game: view(game) })
      return true
    }

    if (m[2] === 'facts') {
      if (!game.met.includes(characterId)) throw new HttpError(409, 'С этим жителем ты ещё не говорил')
      const ids = Array.isArray(body.factIds) ? body.factIds.filter((x): x is string => typeof x === 'string').slice(0, 20) : []
      discover(game, characterId, ids)
      send(res, 200, { game: view(game) })
      return true
    }

    if (characterId !== game.scenario.solver_id || !game.met.includes(characterId)) throw new HttpError(409, 'Этот житель не может закрыть задание')
    if (game.status === 'active') finishGame(db, game)
    send(res, 200, { game: view(game) })
    return true
  }
}
