import { createHmac, timingSafeEqual } from 'node:crypto'

export const COOKIE = 'gd_session'
export const MAX_AGE = 180 * 24 * 60 * 60

function sign(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

export function issue(secret: string, userId: number): string {
  const value = String(userId)
  return `${value}.${sign(secret, value)}`
}

export function verify(secret: string, token: string | undefined): number | null {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const value = token.slice(0, dot)
  if (!/^\d+$/.test(value)) return null
  const expected = Buffer.from(sign(secret, value))
  const actual = Buffer.from(token.slice(dot + 1))
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  return Number(value)
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return undefined
}
