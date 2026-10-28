import { randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { ambienceOf, type AmbienceStore } from './ambience.ts'
import type { SceneStore } from './images.ts'
import type { ScenarioGenerator } from './providers.ts'
import { timeOfDay, type Level, type Scenario, type TimeOfDay } from './scenario.ts'

const DEMAND_WINDOW_MS = 24 * 3600_000
const MAX_AGE_MS = 2 * 24 * 3600_000
const LOOKAHEAD_MIN = 45

export interface PoolDeps {
  scenarios: ScenarioGenerator | null
  scenes: SceneStore | null
  ambience?: AmbienceStore | null
  size: number
}

export interface PoolTarget {
  level: Level
  time: TimeOfDay
}

const now = () => new Date().toISOString()

export function hourOffset(clientHour: number, serverHour: number): number {
  return ((((clientHour - serverHour) % 24) + 36) % 24) - 12
}

export function touchDemand(db: DatabaseSync, level: Level, offset: number): void {
  db.prepare(
    'INSERT INTO city_demand (level, offset, last_at) VALUES (?, ?, ?) ON CONFLICT(level, offset) DO UPDATE SET last_at = excluded.last_at',
  ).run(level, offset, now())
}

export function poolTargets(db: DatabaseSync, at: Date): PoolTarget[] {
  const rows = db
    .prepare('SELECT level, offset FROM city_demand WHERE last_at >= ?')
    .all(new Date(at.getTime() - DEMAND_WINDOW_MS).toISOString()) as { level: Level; offset: number }[]
  const targets = new Map<string, PoolTarget>()
  for (const { level, offset } of rows) {
    const local = new Date(at.getTime() + offset * 3600_000)
    const hour = local.getHours()
    const soon = new Date(local.getTime() + LOOKAHEAD_MIN * 60_000).getHours()
    for (const h of new Set([hour, soon])) {
      const t = { level, time: timeOfDay(h) }
      targets.set(`${t.level}/${t.time}`, t)
    }
  }
  return [...targets.values()]
}

export function poolCount(db: DatabaseSync, t: PoolTarget): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM city_pool WHERE level = ? AND time = ?').get(t.level, t.time) as { n: number }).n
}

export function takeFromPool(db: DatabaseSync, t: PoolTarget): { id: string; scenario: Scenario } | null {
  const row = db
    .prepare('SELECT id, scenario FROM city_pool WHERE level = ? AND time = ? ORDER BY created_at LIMIT 1')
    .get(t.level, t.time) as { id: string; scenario: string } | undefined
  if (!row) return null
  db.prepare('DELETE FROM city_pool WHERE id = ?').run(row.id)
  return { id: row.id, scenario: JSON.parse(row.scenario) }
}

function recentGoalsAll(db: DatabaseSync, limit: number): string[] {
  const games = db.prepare('SELECT scenario FROM city_games ORDER BY created_at DESC LIMIT ?').all(limit) as { scenario: string }[]
  const pooled = db.prepare('SELECT scenario FROM city_pool ORDER BY created_at DESC LIMIT ?').all(limit) as { scenario: string }[]
  return [...pooled, ...games].map((r) => (JSON.parse(r.scenario) as Scenario).goal_ru).slice(0, limit)
}

export function createPool(db: DatabaseSync, deps: PoolDeps) {
  let running = false
  let again = false

  const fillOne = async (t: PoolTarget) => {
    const scenario = await deps.scenarios!.generate(t.level, recentGoalsAll(db, 12), t.time)
    const id = randomBytes(9).toString('base64url')
    db.prepare('INSERT INTO city_pool (id, level, time, scenario, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id, t.level, t.time, JSON.stringify(scenario), now(),
    )
    const start = scenario.characters.find((c) => c.id === scenario.start_id)
    if (start) await deps.scenes?.ensure(id, start, scenario.time_of_day)
    await deps.ambience?.ensureMany(scenario.characters.map(ambienceOf))
  }

  const refill = async (at = new Date()) => {
    if (!deps.scenarios || deps.size <= 0) return
    if (running) {
      again = true
      return
    }
    running = true
    try {
      db.prepare('DELETE FROM city_pool WHERE created_at < ?').run(new Date(at.getTime() - MAX_AGE_MS).toISOString())
      for (const t of poolTargets(db, at)) {
        while (poolCount(db, t) < deps.size) {
          try {
            await fillOne(t)
          } catch (e) {
            console.error(`pool ${t.level}/${t.time}:`, e instanceof Error ? e.message : e)
            return
          }
        }
      }
    } finally {
      running = false
      if (again) {
        again = false
        void refill()
      }
    }
  }

  return { refill }
}
