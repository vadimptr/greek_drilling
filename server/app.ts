import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import { nameError } from '../src/logic/name.ts'
import { createUser, findUser, readProgress, userById, writeProgress, type UserRow } from './db.ts'
import { COOKIE, issue, MAX_AGE, readCookie, verify } from './session.ts'

const MAX_BODY = 256 * 1024
const ENTERS_PER_MINUTE = 30

class HttpError extends Error {
  status: number
  extra?: Record<string, unknown>
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

function send(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}): void {
  if (body === undefined) {
    res.writeHead(status, { 'Cache-Control': 'no-store', ...headers })
    res.end()
    return
  }
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(data),
    ...headers,
  })
  res.end(data)
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) throw new HttpError(413, 'Слишком большой запрос')
    chunks.push(chunk as Buffer)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'Тело запроса — не JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new HttpError(400, 'Ожидается объект')
  return parsed as Record<string, unknown>
}

function isHttps(req: IncomingMessage): boolean {
  return req.headers['x-forwarded-proto'] === 'https'
}

function sessionCookie(req: IncomingMessage, value: string, maxAge: number): string {
  return `${COOKIE}=${value}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`
}

export function createApp(db: DatabaseSync, secret: string) {
  const enters = new Map<string, number[]>()
  const limitEnters = (req: IncomingMessage) => {
    const ip = (req.headers['x-real-ip'] as string | undefined) ?? req.socket.remoteAddress ?? '?'
    const now = Date.now()
    const recent = (enters.get(ip) ?? []).filter((t) => now - t < 60_000)
    if (recent.length >= ENTERS_PER_MINUTE) throw new HttpError(429, 'Слишком много попыток, подождите минуту')
    recent.push(now)
    enters.set(ip, recent)
  }

  const currentUser = (req: IncomingMessage): UserRow | undefined => {
    const id = verify(secret, readCookie(req.headers.cookie, COOKIE))
    return id === null ? undefined : userById(db, id)
  }

  const requireUser = (req: IncomingMessage): UserRow => {
    const user = currentUser(req)
    if (!user) throw new HttpError(401, 'Нужно войти')
    return user
  }

  const routes: Record<string, (req: IncomingMessage, res: ServerResponse) => Promise<void> | void> = {
    'POST /api/enter': async (req, res) => {
      limitEnters(req)
      const body = await readJson(req)
      const raw = typeof body.name === 'string' ? body.name : ''
      const error = nameError(raw)
      if (error) throw new HttpError(400, error)
      const name = raw.trim()
      let user = findUser(db, name)
      let status = 200
      if (!user) {
        if (body.create !== true) throw new HttpError(404, 'Такого имени ещё нет', { exists: false })
        user = createUser(db, name)
        status = 201
      }
      send(res, status, { name: user.name, state: readProgress(db, user.id) }, {
        'Set-Cookie': sessionCookie(req, issue(secret, user.id), MAX_AGE),
      })
    },
    'GET /api/me': (req, res) => {
      const user = requireUser(req)
      send(res, 200, { name: user.name, state: readProgress(db, user.id) })
    },
    'POST /api/logout': (req, res) => {
      send(res, 204, undefined, { 'Set-Cookie': sessionCookie(req, '', 0) })
    },
    'PUT /api/progress': async (req, res) => {
      const user = requireUser(req)
      const body = await readJson(req)
      const state = body.state
      if (typeof state !== 'object' || state === null || Array.isArray(state)) throw new HttpError(400, 'state — не объект')
      writeProgress(db, user.id, JSON.stringify(state))
      send(res, 204)
    },
  }

  return async (req: IncomingMessage, res: ServerResponse) => {
    const path = (req.url ?? '/').split('?')[0]
    const handler = routes[`${req.method} ${path}`]
    try {
      if (!handler) throw new HttpError(404, 'Не найдено')
      await handler(req, res)
    } catch (e) {
      if (e instanceof HttpError) {
        send(res, e.status, { error: e.message, ...e.extra })
      } else {
        console.error(e)
        send(res, 500, { error: 'Ошибка сервера' })
      }
    }
  }
}
