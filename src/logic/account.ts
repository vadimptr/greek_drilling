export interface Session {
  name: string
  state: unknown
}

export type EnterResult = { kind: 'ok'; session: Session } | { kind: 'missing' } | { kind: 'error'; message: string }

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function enter(name: string, create: boolean): Promise<EnterResult> {
  try {
    const res = await fetch('/api/enter', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ name: name.trim(), create }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok) return { kind: 'ok', session: body as Session }
    if (res.status === 404 && body.exists === false) return { kind: 'missing' }
    return { kind: 'error', message: typeof body.error === 'string' ? body.error : 'Не удалось войти' }
  } catch {
    return { kind: 'error', message: 'Нет связи с сервером' }
  }
}

export async function me(): Promise<Session | 'anonymous' | 'offline'> {
  try {
    const res = await fetch('/api/me')
    if (res.status === 401) return 'anonymous'
    if (!res.ok) return 'offline'
    return (await res.json()) as Session
  } catch {
    return 'offline'
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/logout', { method: 'POST' })
  } catch {
    return
  }
}

export async function saveProgress(state: unknown, keepalive = false): Promise<boolean> {
  try {
    const res = await fetch('/api/progress', {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ state }),
      keepalive,
    })
    return res.ok
  } catch {
    return false
  }
}
