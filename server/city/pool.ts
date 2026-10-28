import { randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { ambienceOf, type AmbienceStore } from './ambience.ts'
import type { SceneStore } from './images.ts'
import type { ScenarioGenerator } from './providers.ts'
import type { Level, Scenario, TimeOfDay } from './scenario.ts'

const MAX_AGE_MS = 14 * 24 * 3600_000
const LEVELS: Level[] = ['A1', 'A2', 'B1']
const TIMES: TimeOfDay[] = ['morning', 'noon', 'evening', 'night']

export const randomTime = (): TimeOfDay => TIMES[Math.floor(Math.random() * TIMES.length)]

export interface PoolDeps {
  scenarios: ScenarioGenerator | null
  scenes: SceneStore | null
  ambience?: AmbienceStore | null
  size: number | Partial<Record<Level, number>>
}

export function parsePoolSizes(raw: string | undefined, fallback: number): Record<Level, number> {
  const sizes: Record<Level, number> = { A1: fallback, A2: fallback, B1: fallback }
  for (const pair of (raw ?? '').split(',')) {
    const [level, n] = pair.split(':').map((x) => x.trim())
    if (LEVELS.includes(level as Level) && /^\d+$/.test(n ?? '')) sizes[level as Level] = Number(n)
  }
  return sizes
}

const now = () => new Date().toISOString()

export function poolCount(db: DatabaseSync, level: Level): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM city_pool WHERE level = ?').get(level) as { n: number }).n
}

export function takeFromPool(db: DatabaseSync, level: Level): { id: string; scenario: Scenario } | null {
  const row = db.prepare('SELECT id, scenario FROM city_pool WHERE level = ? ORDER BY created_at LIMIT 1').get(level) as
    | { id: string; scenario: string }
    | undefined
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

  const fillOne = async (level: Level) => {
    const time = randomTime()
    const scenario = await deps.scenarios!.generate(level, recentGoalsAll(db, 20), time)
    const id = randomBytes(9).toString('base64url')
    db.prepare('INSERT INTO city_pool (id, level, time, scenario, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id, level, time, JSON.stringify(scenario), now(),
    )
    const start = scenario.characters.find((c) => c.id === scenario.start_id)
    if (start) await deps.scenes?.ensure(id, start, scenario.time_of_day)
    await deps.ambience?.ensureMany(scenario.characters.map(ambienceOf))
  }

  const refill = async (at = new Date()) => {
    const sizeOf = (level: Level) => (typeof deps.size === 'number' ? deps.size : (deps.size[level] ?? 0))
    const most = Math.max(...LEVELS.map(sizeOf))
    if (!deps.scenarios || most <= 0) return
    if (running) {
      again = true
      return
    }
    running = true
    try {
      db.prepare('DELETE FROM city_pool WHERE created_at < ?').run(new Date(at.getTime() - MAX_AGE_MS).toISOString())
      for (let round = 0; round < most; round++) {
        for (const level of LEVELS) {
          if (poolCount(db, level) >= sizeOf(level)) continue
          try {
            await fillOne(level)
          } catch (e) {
            console.error(`pool ${level}:`, e instanceof Error ? e.message : e)
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
