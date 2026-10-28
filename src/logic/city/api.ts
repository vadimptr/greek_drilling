import type { Level } from '../../types/word'

export interface CharacterCard {
  id: string
  name: string
  nameRu: string
  role: string
  place: string
}

export interface NoteFact {
  id: string
  text: string
  points: number
  goal: boolean
}

export interface NotePerson {
  id: string
  name: string
  nameRu: string
  facts: NoteFact[]
  hidden: number
}

export interface CityGame {
  id: string
  notebook: NotePerson[]
  score: number
  total: number
  city: string
  goal: string
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
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new CityError(0, 'Нет связи с сервером')
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new CityError(res.status, typeof data.error === 'string' ? data.error : 'Ошибка сервера')
  return data as T
}

export async function cityAccess(): Promise<{ allowed: boolean; total: number }> {
  try {
    return await call('GET', '/api/city')
  } catch {
    return { allowed: false, total: 0 }
  }
}

export const currentGame = () => call<{ game: CityGame | null }>('GET', '/api/city/games/current').then((r) => r.game)
export const newGame = (level: Level) => call<{ game: CityGame }>('POST', '/api/city/games', { level }).then((r) => r.game)
export const talk = (gameId: string, characterId: string, from: string | null) =>
  call<Talk>('POST', `/api/city/games/${gameId}/talk`, { characterId, from })
export const saveLines = (gameId: string, characterId: string, lines: Line[]) =>
  call<{ game: CityGame }>('POST', `/api/city/games/${gameId}/lines`, { characterId, lines }).then((r) => r.game)
export const revealFacts = (gameId: string, characterId: string, factIds: string[]) =>
  call<{ game: CityGame }>('POST', `/api/city/games/${gameId}/facts`, { characterId, factIds }).then((r) => r.game)
export const completeGame = (gameId: string, characterId: string) =>
  call<{ game: CityGame }>('POST', `/api/city/games/${gameId}/complete`, { characterId }).then((r) => r.game)
