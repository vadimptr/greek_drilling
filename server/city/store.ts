import { randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { Level, Mood, Scenario } from './scenario.ts'

export type GameStatus = 'active' | 'won'

export interface Game {
  id: string
  userId: number
  level: Level
  scenario: Scenario
  met: string[]
  found: string[]
  heard: string[]
  moods: Record<string, Mood>
  reasons: Record<string, string>
  status: GameStatus
}

interface GameRow {
  id: string
  user_id: number
  level: Level
  scenario: string
  met: string
  found: string
  heard: string
  moods: string
  reasons: string
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
    CREATE TABLE IF NOT EXISTS city_level_checks (
      id INTEGER PRIMARY KEY,
      game_id TEXT NOT NULL REFERENCES city_games(id) ON DELETE CASCADE,
      character_id TEXT NOT NULL,
      level TEXT NOT NULL,
      total INTEGER NOT NULL,
      issues TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS city_lines (
      id INTEGER PRIMARY KEY,
      game_id TEXT NOT NULL REFERENCES city_games(id) ON DELETE CASCADE,
      character_id TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
  const cols = db.prepare('PRAGMA table_info(city_games)').all() as { name: string }[]
  if (!cols.some((c) => c.name === 'found')) db.exec("ALTER TABLE city_games ADD COLUMN found TEXT NOT NULL DEFAULT '[]'")
  if (!cols.some((c) => c.name === 'heard')) db.exec("ALTER TABLE city_games ADD COLUMN heard TEXT NOT NULL DEFAULT '[]'")
  if (!cols.some((c) => c.name === 'reasons')) db.exec("ALTER TABLE city_games ADD COLUMN reasons TEXT NOT NULL DEFAULT '{}'")
  if (!cols.some((c) => c.name === 'moods')) db.exec("ALTER TABLE city_games ADD COLUMN moods TEXT NOT NULL DEFAULT '{}'")
}

const toGame = (r: GameRow): Game => ({
  id: r.id,
  userId: r.user_id,
  level: r.level,
  scenario: JSON.parse(r.scenario),
  met: JSON.parse(r.met),
  found: JSON.parse(r.found),
  heard: JSON.parse(r.heard),
  moods: JSON.parse(r.moods),
  reasons: JSON.parse(r.reasons),
  status: r.status,
})

const now = () => new Date().toISOString()

export function createGame(db: DatabaseSync, userId: number, level: Level, scenario: Scenario): Game {
  const id = randomBytes(9).toString('base64url')
  const t = now()
  db.prepare('INSERT INTO city_games (id, user_id, level, scenario, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, userId, level, JSON.stringify(scenario), t, t,
  )
  return { id, userId, level, scenario, met: [], found: [], heard: [], moods: {}, reasons: {}, status: 'active' }
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

export function addFound(db: DatabaseSync, game: Game, factIds: string[]): string[] {
  const added = factIds.filter((id) => !game.found.includes(id))
  if (!added.length) return added
  game.found.push(...added)
  db.prepare('UPDATE city_games SET found = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(game.found), now(), game.id)
  return added
}

export function allGames(db: DatabaseSync, userId: number): Game[] {
  return (db.prepare('SELECT * FROM city_games WHERE user_id = ?').all(userId) as unknown as GameRow[]).map(toGame)
}

export function saveScenario(db: DatabaseSync, game: Game): void {
  db.prepare('UPDATE city_games SET scenario = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(game.scenario), now(), game.id)
}

export function addHeard(db: DatabaseSync, game: Game, ids: string[]): void {
  const added = ids.filter((id) => !game.heard.includes(id))
  if (!added.length) return
  game.heard.push(...added)
  db.prepare('UPDATE city_games SET heard = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(game.heard), now(), game.id)
}

export function setMood(db: DatabaseSync, game: Game, characterId: string, mood: Mood, reason: string): void {
  game.moods[characterId] = mood
  game.reasons[characterId] = reason
  db.prepare('UPDATE city_games SET moods = ?, reasons = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(game.moods), JSON.stringify(game.reasons), now(), game.id,
  )
}

export function linesFor(db: DatabaseSync, game: Game, characterId: string, limit: number): { role: string; text: string }[] {
  const rows = db
    .prepare('SELECT role, text FROM city_lines WHERE game_id = ? AND character_id = ? ORDER BY id DESC LIMIT ?')
    .all(game.id, characterId, limit) as { role: string; text: string }[]
  return rows.reverse()
}

export function everyGame(db: DatabaseSync): Game[] {
  return (db.prepare('SELECT * FROM city_games').all() as unknown as GameRow[]).map(toGame)
}

export interface LevelCheck {
  level: string
  total: number
  issues: { text: string; reason: string; note: string }[]
}

export function addLevelCheck(db: DatabaseSync, game: Game, characterId: string, check: LevelCheck): void {
  db.prepare('INSERT INTO city_level_checks (game_id, character_id, level, total, issues, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    game.id, characterId, check.level, check.total, JSON.stringify(check.issues), now(),
  )
}

export function recentLevelNotes(db: DatabaseSync, game: Game, limit: number): string[] {
  const rows = db.prepare('SELECT issues FROM city_level_checks WHERE game_id = ? ORDER BY id DESC LIMIT 3').all(game.id) as { issues: string }[]
  const notes = rows.flatMap((r) => (JSON.parse(r.issues) as LevelCheck['issues']).map((i) => i.note))
  return [...new Set(notes)].slice(0, limit)
}
