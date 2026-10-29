import { randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { ambienceKeysOf, type AmbienceStore } from './ambience.ts'
import type { SceneStore } from './images.ts'
import type { ScenarioGenerator } from './providers.ts'
import { LANGS, normalizeScenario, type Lang, type Level, type Scenario, type TimeOfDay } from './scenario.ts'
import { goalText } from './store.ts'

const MAX_AGE_MS = 14 * 24 * 3600_000
const LEVELS: Level[] = ['A1', 'A2', 'B1']
const TIMES: TimeOfDay[] = ['morning', 'noon', 'evening', 'night']

export const randomTime = (): TimeOfDay => TIMES[Math.floor(Math.random() * TIMES.length)]

export type PoolSizes = Record<Lang, Record<Level, number>>

export const EXTRA_POOL: Record<Level, number> = { A1: 2, A2: 1, B1: 1 }

export interface PoolDeps {
  scenarios: ScenarioGenerator | null
  scenes: SceneStore | null
  ambience?: AmbienceStore | null
  size: number | Partial<Record<Level, number>> | PoolSizes
}

export function parsePoolSizes(raw: string | undefined, fallback: number): PoolSizes {
  const sizes: PoolSizes = {
    el: { A1: fallback, A2: fallback, B1: fallback },
    en: { ...EXTRA_POOL },
    ru: { ...EXTRA_POOL },
  }
  for (const pair of (raw ?? '').split(',')) {
    const [key, n] = pair.split(':').map((x) => x.trim())
    const [lang, level] = key?.includes('.') ? key.split('.') : ['el', key]
    if (LANGS.includes(lang as Lang) && LEVELS.includes(level as Level) && /^\d+$/.test(n ?? '')) sizes[lang as Lang][level as Level] = Number(n)
  }
  return sizes
}

function sizeOf(size: PoolDeps['size'], lang: Lang, level: Level): number {
  if (typeof size === 'number') return lang === 'el' ? size : 0
  if ('el' in size || 'en' in size || 'ru' in size) return (size as PoolSizes)[lang]?.[level] ?? 0
  return lang === 'el' ? ((size as Partial<Record<Level, number>>)[level] ?? 0) : 0
}

const now = () => new Date().toISOString()

export function poolCount(db: DatabaseSync, level: Level, lang: Lang = 'el'): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM city_pool WHERE level = ? AND lang = ?').get(level, lang) as { n: number }).n
}

export function takeFromPool(db: DatabaseSync, level: Level, lang: Lang = 'el'): { id: string; scenario: Scenario } | null {
  const row = db.prepare('SELECT id, scenario FROM city_pool WHERE level = ? AND lang = ? ORDER BY created_at LIMIT 1').get(level, lang) as
    | { id: string; scenario: string }
    | undefined
  if (!row) return null
  db.prepare('DELETE FROM city_pool WHERE id = ?').run(row.id)
  return { id: row.id, scenario: normalizeScenario({ lang, ...JSON.parse(row.scenario) }) }
}

function recentGoalsAll(db: DatabaseSync, lang: Lang, limit: number): string[] {
  const games = db.prepare('SELECT scenario FROM city_games WHERE lang = ? ORDER BY created_at DESC LIMIT ?').all(lang, limit) as { scenario: string }[]
  const pooled = db.prepare('SELECT scenario FROM city_pool WHERE lang = ? ORDER BY created_at DESC LIMIT ?').all(lang, limit) as { scenario: string }[]
  return [...pooled, ...games].map((r) => goalText(JSON.parse(r.scenario) as Scenario)).slice(0, limit)
}

export function createPool(db: DatabaseSync, deps: PoolDeps) {
  let running = false
  let again = false
  const queues = LANGS.flatMap((lang) => LEVELS.map((level) => ({ lang, level })))

  const fillOne = async (lang: Lang, level: Level) => {
    const time = randomTime()
    const scenario = await deps.scenarios!.generate(level, recentGoalsAll(db, lang, 20), time, lang)
    scenario.lang = lang
    const id = randomBytes(9).toString('base64url')
    db.prepare('INSERT INTO city_pool (id, lang, level, time, scenario, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, lang, level, time, JSON.stringify(scenario), now(),
    )
    const start = scenario.characters.find((c) => c.id === scenario.start_id)
    if (start) await deps.scenes?.ensure(id, start, scenario.time_of_day, lang)
    await deps.ambience?.ensureMany(ambienceKeysOf(scenario))
  }

  const refill = async (at = new Date()) => {
    const most = Math.max(...queues.map((q) => sizeOf(deps.size, q.lang, q.level)))
    if (!deps.scenarios || most <= 0) return
    if (running) {
      again = true
      return
    }
    running = true
    try {
      db.prepare('DELETE FROM city_pool WHERE created_at < ?').run(new Date(at.getTime() - MAX_AGE_MS).toISOString())
      for (let round = 0; round < most; round++) {
        for (const { lang, level } of queues) {
          if (poolCount(db, level, lang) >= sizeOf(deps.size, lang, level)) continue
          try {
            await fillOne(lang, level)
          } catch (e) {
            console.error(`pool ${lang} ${level}:`, e instanceof Error ? e.message : e)
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
