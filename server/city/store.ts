import { randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { Level, Scenario } from './scenario.ts'

export type GameStatus = 'active' | 'won'

export interface Game {
  id: string
  userId: number
  level: Level
  scenario: Scenario
  met: string[]
  status: GameStatus
}

interface GameRow {
  id: string
  user_id: number
  level: Level
  scenario: string
  met: string
  status: GameStatus
}

export function migrateCity(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS city_games (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      level TEXT NOT NULL,
      scenario TEXT NOT NULL,
      met TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_city_games_user ON city_games(user_id, created_at);
    CREATE TABLE IF NOT EXISTS city_talks (
      id INTEGER PRIMARY KEY,
      game_id TEXT NOT NULL REFERENCES city_games(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      character_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_city_talks_user ON city_talks(user_id, created_at);
    CREATE TABLE IF NOT EXISTS city_lines (
      id INTEGER PRIMARY KEY,
      game_id TEXT NOT NULL REFERENCES city_games(id) ON DELETE CASCADE,
      character_id TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
}

const toGame = (r: GameRow): Game => ({
  id: r.id,
  userId: r.user_id,
  level: r.level,
  scenario: JSON.parse(r.scenario),
  met: JSON.parse(r.met),
  status: r.status,
})

const now = () => new Date().toISOString()

export function createGame(db: DatabaseSync, userId: number, level: Level, scenario: Scenario): Game {
  const id = randomBytes(9).toString('base64url')
  const t = now()
  db.prepare('INSERT INTO city_games (id, user_id, level, scenario, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, userId, level, JSON.stringify(scenario), t, t,
  )
  return { id, userId, level, scenario, met: [], status: 'active' }
}

export function findGame(db: DatabaseSync, userId: number, id: string): Game | undefined {
  const row = db.prepare('SELECT * FROM city_games WHERE id = ? AND user_id = ?').get(id, userId) as GameRow | undefined
  return row && toGame(row)
}

export function currentGame(db: DatabaseSync, userId: number): Game | undefined {
  const row = db
    .prepare("SELECT * FROM city_games WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1")
    .get(userId) as GameRow | undefined
  return row && toGame(row)
}

export function recentGoals(db: DatabaseSync, userId: number, limit = 10): string[] {
  const rows = db.prepare('SELECT scenario FROM city_games WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit) as {
    scenario: string
  }[]
  return rows.map((r) => (JSON.parse(r.scenario) as Scenario).goal_ru)
}

export function markMet(db: DatabaseSync, game: Game, characterId: string): void {
  if (!game.met.includes(characterId)) game.met.push(characterId)
  db.prepare('UPDATE city_games SET met = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(game.met), now(), game.id)
}

export function finishGame(db: DatabaseSync, game: Game): void {
  game.status = 'won'
  db.prepare("UPDATE city_games SET status = 'won', updated_at = ? WHERE id = ?").run(now(), game.id)
}

export function abandonActive(db: DatabaseSync, userId: number): void {
  db.prepare("DELETE FROM city_games WHERE user_id = ? AND status = 'active' AND met = '[]'").run(userId)
}

export function recordTalk(db: DatabaseSync, game: Game, characterId: string, provider: string): void {
  db.prepare('INSERT INTO city_talks (game_id, user_id, character_id, provider, created_at) VALUES (?, ?, ?, ?, ?)').run(
    game.id, game.userId, characterId, provider, now(),
  )
}

export function talksSince(db: DatabaseSync, userId: number, since: Date): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM city_talks WHERE user_id = ? AND created_at >= ?').get(userId, since.toISOString()) as {
    n: number
  }
  return row.n
}

export function addLines(db: DatabaseSync, game: Game, characterId: string, lines: { role: string; text: string }[]): void {
  const stmt = db.prepare('INSERT INTO city_lines (game_id, character_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)')
  const t = now()
  for (const l of lines) stmt.run(game.id, characterId, l.role, l.text, t)
}
