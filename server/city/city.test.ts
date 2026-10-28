import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from '../app.ts'
import { openDb } from '../db.ts'
import { elevenLabsVoice, parseVoices } from './elevenlabs.ts'
import type { CityDeps } from './routes.ts'
import { buildPersona, validateScenario, type Scenario } from './scenario.ts'

const SECRET = 'test-secret-0123456789'

function scenario(): Scenario {
  const base = { gender: 'male' as const, age: 'old' as const, personality: 'grumpy', greeting_el: 'Γεια!' }
  return {
    goal_ru: 'Узнай у рыбака, что он поймал',
    goal_check: 'today catch and prices',
    start_id: 'eleni',
    solver_id: 'yiannis',
    characters: [
      { ...base, id: 'eleni', name_el: 'Ελένη', name_ru: 'Элени', role_ru: 'племянница рыбака', gender: 'female', age: 'young',
        place_el: 'πλατεία', place_ru: 'площадь', knows: 'uncle is at the harbour', refers_to: ['kostas'] },
      { ...base, id: 'kostas', name_el: 'Κώστας', name_ru: 'Костас', role_ru: 'хозяин кафе', place_el: 'καφενείο', place_ru: 'кафе',
        knows: 'Yiannis sells at the fish market', refers_to: ['yiannis', 'ghost'] },
      { ...base, id: 'yiannis', name_el: 'Γιάννης', name_ru: 'Яннис', role_ru: 'рыбак', place_el: 'λιμάνι', place_ru: 'пристань',
        knows: 'caught 5 kg of sardines, 6 euro per kilo', refers_to: [] },
    ],
  }
}

async function start(overrides: Partial<CityDeps> = {}) {
  const db = openDb(':memory:')
  const opened: string[] = []
  const deps: CityDeps = {
    allowedUsers: ['Vadim'],
    dailyTalks: 10,
    scenarios: { generate: async () => validateScenario(scenario()) },
    voice: { id: 'fake', open: async (p) => { opened.push(p.systemPrompt); return { provider: 'fake', connection: { token: 't' } } } },
    ...overrides,
  }
  const server = createServer(createApp(db, SECRET, deps))
  await new Promise<void>((r) => server.listen(0, r))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const call = async (method: string, path: string, body?: unknown, cookie?: string) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : null, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] }
  }
  const login = async (name: string) => (await call('POST', '/api/enter', { name, create: true })).cookie
  return { call, login, opened, close: () => new Promise((r) => server.close(r)) }
}

test('city is visible only to allowed users', async () => {
  const { call, login, close } = await start()
  assert.deepEqual((await call('GET', '/api/city')).body, { allowed: false, city: 'Μυθόπολη' })
  const guest = await login('Guest')
  assert.equal((await call('GET', '/api/city', undefined, guest)).body.allowed, false)
  assert.equal((await call('POST', '/api/city/games', {}, guest)).status, 403)
  const me = await login('vadim')
  assert.equal((await call('GET', '/api/city', undefined, me)).body.allowed, true)
  await close()
})

test('game flow: start character, referral chain, completion only by the solver', async () => {
  const { call, login, opened, close } = await start()
  const me = await login('Vadim')
  const created = await call('POST', '/api/city/games', { level: 'A1' }, me)
  assert.equal(created.status, 201)
  const game = created.body.game
  assert.equal(game.goal, 'Узнай у рыбака, что он поймал')
  assert.equal(game.startId, 'eleni')

  const talk = (characterId: string, from?: string) => call('POST', `/api/city/games/${game.id}/talk`, { characterId, from }, me)
  assert.equal((await talk('yiannis')).status, 409)
  const first = await talk('eleni')
  assert.equal(first.status, 200)
  assert.deepEqual(first.body.character, { id: 'eleni', name: 'Ελένη', nameRu: 'Элени', role: 'племянница рыбака', place: 'площадь' })
  assert.deepEqual(first.body.session, { provider: 'fake', connection: { token: 't' } })
  assert.deepEqual(first.body.game.known.sort(), ['eleni', 'kostas'])
  assert.equal((await talk('kostas', 'eleni')).status, 200)
  assert.match(opened[1], /sent them to you/)

  assert.equal((await call('POST', `/api/city/games/${game.id}/complete`, { characterId: 'kostas' }, me)).status, 409)
  assert.equal((await talk('yiannis', 'kostas')).status, 200)
  assert.match(opened[2], /call the tool goal_completed/)
  assert.equal((await call('POST', `/api/city/games/${game.id}/lines`, { characterId: 'yiannis', lines: [{ role: 'user', text: 'Γεια' }] }, me)).status, 204)
  const done = await call('POST', `/api/city/games/${game.id}/complete`, { characterId: 'yiannis' }, me)
  assert.equal(done.body.game.status, 'won')
  assert.equal((await talk('yiannis')).status, 409)
  assert.equal((await call('GET', '/api/city/games/current', undefined, me)).body.game, null)
  await close()
})

test('daily talk limit and foreign games', async () => {
  const { call, login, close } = await start({ dailyTalks: 1, allowedUsers: ['Vadim', 'Anna'] })
  const me = await login('Vadim')
  const game = (await call('POST', '/api/city/games', {}, me)).body.game
  assert.equal((await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'eleni' }, me)).status, 200)
  assert.equal((await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'eleni' }, me)).status, 429)
  const anna = await login('Anna')
  assert.equal((await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'eleni' }, anna)).status, 404)
  await close()
})

test('provider failure becomes 502', async () => {
  const { call, login, close } = await start({ scenarios: { generate: async () => { throw new Error('boom') } } })
  const errors = console.error
  console.error = () => {}
  const res = await call('POST', '/api/city/games', {}, await login('Vadim'))
  console.error = errors
  assert.equal(res.status, 502)
  await close()
})

test('scenario validation drops unknown links and rejects unreachable solver', () => {
  const ok = validateScenario(scenario())
  assert.deepEqual(ok.characters[1].refers_to, ['yiannis'])
  const broken = scenario()
  broken.characters[1].refers_to = []
  assert.throws(() => validateScenario(broken), /unreachable/)
  const self = scenario()
  self.solver_id = 'eleni'
  assert.throws(() => validateScenario(self), /start is the solver/)
})

test('persona speaks only Greek at the chosen level and lists contacts', () => {
  const p = buildPersona(validateScenario(scenario()), 'kostas', 'A1', ['eleni'], 'eleni')
  assert.match(p.systemPrompt, /Speak ONLY Greek/)
  assert.match(p.systemPrompt, /CEFR A1/)
  assert.match(p.systemPrompt, /id "yiannis": Γιάννης/)
  assert.match(p.systemPrompt, /Never call the tool goal_completed/)
  assert.equal(p.language, 'el')
  assert.ok(p.keywords.includes('Μυθόπολη'))
})

test('elevenlabs session carries token, persona overrides and the matching voice', async () => {
  const voices = parseVoices('male-old=v1, female=v2, junk, robot=v3')
  assert.deepEqual(voices, { 'male-old': 'v1', female: 'v2' })
  let url = ''
  const fakeFetch = (async (u: string) => {
    url = u
    return new Response(JSON.stringify({ token: 'tok' }))
  }) as typeof fetch
  const provider = elevenLabsVoice({ apiKey: 'k', agentId: 'agent_1', voices, speed: 0.9 }, fakeFetch)
  const persona = buildPersona(validateScenario(scenario()), 'eleni', 'A2', [], null)
  const s = await provider.open(persona)
  assert.match(url, /conversation\/token\?agent_id=agent_1$/)
  const conn = s.connection as { conversationToken: string; overrides: { tts: { voiceId?: string; speed: number } } }
  assert.equal(conn.conversationToken, 'tok')
  assert.deepEqual(conn.overrides.tts, { voiceId: 'v2', speed: 0.9 })
})
