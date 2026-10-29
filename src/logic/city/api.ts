import type { Level } from '../../types/word'
import { translate } from '../i18n'
import type { Lang } from './name'

let langs: { learn: Lang; hint: Lang } = { learn: 'el', hint: 'ru' }

export function setCityLangs(learn: Lang, hint: Lang): void {
  langs = { learn, hint }
}

export interface CharacterCard {
  id: string
  name: string
  nameHint: string
  role: string
  roleHint: string
  place: string
  placeHint: string
  scene?: string | null
  sceneState?: SceneState
  ambience?: string | null
}

export type SceneState =
  | { state: 'ready' }
  | { state: 'queued' }
  | { state: 'drawing'; elapsedMs: number; expectedMs: number }
  | { state: 'failed' }
  | { state: 'none' }

export interface NoteFact {
  id: string
  text: string
  points: number
  goal: boolean
}

export type Mood = 'friendly' | 'annoyed' | 'offended' | 'angry'

export interface NotePerson {
  id: string
  name: string
  nameHint: string
  gender: 'male' | 'female'
  met: boolean
  mood: Mood
  moodReason: string
  facts: NoteFact[]
  hidden: number
}

export interface CityGame {
  id: string
  notebook: NotePerson[]
  scenesEnabled: boolean
  score: number
  total: number
  lang: Lang
  city: string
  goal: string
  goalHint: string
  status: 'active' | 'won'
  startId: string
  met: string[]
  known: string[]
  characters: CharacterCard[]
}

export interface VoiceSession {
  provider: string
  connection: Record<string, unknown>
}

export interface Talk {
  character: CharacterCard
  session: VoiceSession
  game: CityGame
}

export interface Line {
  role: 'user' | 'agent'
  text: string
}

export class CityError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: {
        'X-City-Lang': langs.learn,
        'X-City-Hint': langs.hint,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new CityError(0, translate(langs.hint, 'city.offline'))
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (typeof data.error === 'string') throw new CityError(res.status, data.error)
    if (res.status >= 502 && res.status <= 504) throw new CityError(res.status, translate(langs.hint, 'city.updating'))
    throw new CityError(res.status, translate(langs.hint, 'city.serverError'))
  }
  return data as T
}

export async function cityAccess(): Promise<{ allowed: boolean; needsCode: boolean; total: number; storyMs: number }> {
  try {
    return await call('GET', '/api/city')
  } catch {
    return { allowed: false, needsCode: false, total: 0, storyMs: 40_000 }
  }
}

export const unlockCity = (code: string) => call<void>('POST', '/api/city/unlock', { code })

export interface BoardRow {
  rank: number
  value: number
  you: boolean
  name: string | null
}

export interface Board {
  category: 'points' | 'quests' | 'facts'
  players: number
  rows: BoardRow[]
}

export const leaderboard = () => call<{ boards: Board[] }>('GET', '/api/city/leaderboard').then((r) => r.boards)

export const currentGame = () => call<{ game: CityGame | null }>('GET', '/api/city/games/current').then((r) => r.game)
export const newGame = (level: Level) =>
  call<{ game: CityGame }>('POST', '/api/city/games', { level, lang: langs.learn }).then((r) => r.game)
export const talk = (gameId: string, characterId: string, from: string | null, speed: number, resume?: 'voice' | 'tap') =>
  call<Talk>('POST', `/api/city/games/${gameId}/talk`, { characterId, from, speed, resume })
export interface LevelCheck {
  level: string
  total: number
  issues: { text: string; reason: string }[]
}

export const saveLines = (gameId: string, characterId: string, lines: Line[]) =>
  call<{ game: CityGame; check: LevelCheck | null }>('POST', `/api/city/games/${gameId}/lines`, { characterId, lines })
export const introduce = (gameId: string, characterId: string, target: string) =>
  call<{ game: CityGame }>('POST', `/api/city/games/${gameId}/introduce`, { characterId, target }).then((r) => r.game)
export const requestScene = (gameId: string, characterId: string) =>
  call<{ game: CityGame }>('POST', `/api/city/games/${gameId}/scene`, { characterId }).then((r) => r.game)
export const setMood = (gameId: string, characterId: string, mood: string, reason: string) =>
  call<{ game: CityGame }>('POST', `/api/city/games/${gameId}/mood`, { characterId, mood, reason }).then((r) => r.game)
export const revealFacts = (gameId: string, characterId: string, factIds: string[]) =>
  call<{ game: CityGame }>('POST', `/api/city/games/${gameId}/facts`, { characterId, factIds }).then((r) => r.game)
export const completeGame = (gameId: string, characterId: string) =>
  call<{ game: CityGame }>('POST', `/api/city/games/${gameId}/complete`, { characterId }).then((r) => r.game)

const translations = new Map<string, Promise<string>>()

export function translateCached(text: string): Promise<string> {
  const { learn, hint } = langs
  const key = `${hint}:${text.trim()}`
  let pending = translations.get(key)
  if (!pending) {
    pending = call<{ text: string }>('POST', '/api/city/translate', { text: text.trim(), from: learn, to: hint }).then((r) => r.text)
    pending.catch(() => translations.delete(key))
    translations.set(key, pending)
  }
  return pending
}
