import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from './app.ts'
import { openDb } from './db.ts'
import { issue } from './session.ts'

const SECRET = 'test-secret-0123456789'

async function start() {
  const db = openDb(':memory:')
  const server = createServer(createApp(db, SECRET))
  await new Promise<void>((r) => server.listen(0, r))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const call = async (method: string, path: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
    const text = await res.text()
    const setCookie = res.headers.get('set-cookie') ?? ''
    return { status: res.status, body: text ? JSON.parse(text) : null, setCookie, cookie: setCookie.split(';')[0] }
  }
  return { call, close: () => new Promise((r) => server.close(r)) }
}

test('unknown name asks to create, create logs in, same name in other case enters the same account', async () => {
  const { call, close } = await start()
  const miss = await call('POST', '/api/enter', { name: 'Vadim' })
  assert.equal(miss.status, 404)
  assert.equal(miss.body.exists, false)

  const created = await call('POST', '/api/enter', { name: 'Vadim', create: true })
  assert.equal(created.status, 201)
  assert.deepEqual(created.body, { name: 'Vadim', state: null })
  assert.match(created.setCookie, /gd_session=\d+\..+; Path=\/api; HttpOnly; SameSite=Lax; Max-Age=15552000/)
  assert.doesNotMatch(created.setCookie, /Secure/)

  const again = await call('POST', '/api/enter', { name: 'vADIM' })
  assert.equal(again.status, 200)
  assert.equal(again.body.name, 'Vadim')
  assert.equal(again.cookie, created.cookie)

  const createdTwice = await call('POST', '/api/enter', { name: 'vadim', create: true })
  assert.equal(createdTwice.status, 200)
  await close()
})

test('bad names are rejected', async () => {
  const { call, close } = await start()
  for (const name of ['ab', 'a b c', 'x'.repeat(33), 'semi;colon', '', 42]) {
    const r = await call('POST', '/api/enter', { name, create: true })
    assert.equal(r.status, 400, String(name))
  }
  const ok = await call('POST', '/api/enter', { name: '  Αννα_ру-1  ', create: true })
  assert.equal(ok.status, 201)
  assert.equal(ok.body.name, 'Αννα_ру-1')
  await close()
})

test('progress is saved and returned on me and on next enter', async () => {
  const { call, close } = await start()
  const { cookie } = await call('POST', '/api/enter', { name: 'anna', create: true })
  assert.equal((await call('GET', '/api/me', undefined, cookie)).body.state, null)

  const state = { version: 3, words: { learned: [1, 2] } }
  assert.equal((await call('PUT', '/api/progress', { state }, cookie)).status, 204)
  assert.deepEqual((await call('GET', '/api/me', undefined, cookie)).body, { name: 'anna', state })
  assert.deepEqual((await call('POST', '/api/enter', { name: 'ANNA' })).body.state, state)

  assert.equal((await call('PUT', '/api/progress', { state: [1] }, cookie)).status, 400)
  assert.equal((await call('PUT', '/api/progress', 'nope', cookie)).status, 400)
  assert.equal((await call('PUT', '/api/progress', { state: { big: 'x'.repeat(300 * 1024) } }, cookie)).status, 413)
  await close()
})

test('no session or forged session gives 401', async () => {
  const { call, close } = await start()
  await call('POST', '/api/enter', { name: 'anna', create: true })
  assert.equal((await call('GET', '/api/me')).status, 401)
  assert.equal((await call('PUT', '/api/progress', { state: {} })).status, 401)
  assert.equal((await call('GET', '/api/me', undefined, 'gd_session=1.forged')).status, 401)
  assert.equal((await call('GET', '/api/me', undefined, `gd_session=${issue('other-secret-123456', 1)}`)).status, 401)
  assert.equal((await call('GET', '/api/me', undefined, `gd_session=${issue(SECRET, 999)}`)).status, 401)
  assert.equal((await call('GET', '/api/me', undefined, `gd_session=${issue(SECRET, 1)}`)).status, 200)
  await close()
})

test('logout clears the cookie, https gets Secure', async () => {
  const { call, close } = await start()
  const enter = await call('POST', '/api/enter', { name: 'anna', create: true }, undefined, { 'X-Forwarded-Proto': 'https' })
  assert.match(enter.setCookie, /; Secure/)
  const out = await call('POST', '/api/logout', undefined, enter.cookie)
  assert.equal(out.status, 204)
  assert.match(out.setCookie, /gd_session=; .*Max-Age=0/)
  await close()
})

test('enter is rate limited per ip', async () => {
  const { call, close } = await start()
  for (let i = 0; i < 30; i++) await call('POST', '/api/enter', { name: `user${i}` }, undefined, { 'X-Real-IP': '1.2.3.4' })
  assert.equal((await call('POST', '/api/enter', { name: 'user' }, undefined, { 'X-Real-IP': '1.2.3.4' })).status, 429)
  assert.equal((await call('POST', '/api/enter', { name: 'user' }, undefined, { 'X-Real-IP': '5.6.7.8' })).status, 404)
  await close()
})

test('unknown route is 404', async () => {
  const { call, close } = await start()
  assert.equal((await call('GET', '/api/nope')).status, 404)
  await close()
})
