import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DatabaseSync } from 'node:sqlite'
import { nameError } from '../src/logic/name.ts'
import { createUser, findUser, readProgress, userById, writeProgress, type UserRow } from './db.ts'
import { COOKIE, issue, MAX_AGE, readCookie, verify } from './session.ts'
import { HttpError, readJson, send } from './http.ts'
import { createCity, type CityDeps } from './city/routes.ts'

const ENTERS_PER_MINUTE = 30

function isHttps(req: IncomingMessage): boolean {
  return req.headers['x-forwarded-proto'] === 'https'
}

function sessionCookie(req: IncomingMessage, value: string, maxAge: number): string {
  return `${COOKIE}=${value}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`
}

export function createApp(db: DatabaseSync, secret: string, cityDeps?: CityDeps) {
  const city = cityDeps ? createCity(db, cityDeps) : null
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
      if (handler) {
        await handler(req, res)
      } else if (!(city && (await city(req, res, path, currentUser(req))))) {
        throw new HttpError(404, 'Не найдено')
      }
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
