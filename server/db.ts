import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export interface UserRow {
  id: number
  name: string
}

export function openDb(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  return db
}

export function nameKey(name: string): string {
  return name.toLowerCase()
}

export function findUser(db: DatabaseSync, name: string): UserRow | undefined {
  return db.prepare('SELECT id, name FROM users WHERE name_key = ?').get(nameKey(name)) as UserRow | undefined
}

export function userById(db: DatabaseSync, id: number): UserRow | undefined {
  return db.prepare('SELECT id, name FROM users WHERE id = ?').get(id) as UserRow | undefined
}

export function createUser(db: DatabaseSync, name: string): UserRow {
  db.prepare('INSERT INTO users (name, name_key, created_at) VALUES (?, ?, ?) ON CONFLICT(name_key) DO NOTHING').run(
    name,
    nameKey(name),
    new Date().toISOString(),
  )
  return findUser(db, name)!
}

export function readProgress(db: DatabaseSync, userId: number): unknown {
  const row = db.prepare('SELECT state FROM progress WHERE user_id = ?').get(userId) as { state: string } | undefined
  return row ? JSON.parse(row.state) : null
}

export function writeProgress(db: DatabaseSync, userId: number, state: string): void {
  db.prepare(
    'INSERT INTO progress (user_id, state, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at',
  ).run(userId, state, new Date().toISOString())
}
