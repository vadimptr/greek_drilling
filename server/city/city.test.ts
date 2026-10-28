import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from '../app.ts'
import { openDb } from '../db.ts'
import { dropModeratedVoices, elevenLabsVoice, parseVoices, pickVoice } from './elevenlabs.ts'
import type { CityDeps } from './routes.ts'
import { buildPersona, validateScenario, type Fact, type Scenario } from './scenario.ts'
import { leaderboard, stripTags } from './routes.ts'
import type { Game } from './store.ts'

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
    facts: [
      fact('f1', 'eleni', 'на вид лет двадцать', 0, { initial: true }),
      fact('f2', 'eleni', 'учится в Салониках', 10),
      fact('f3', 'kostas', 'на вид лет пятьдесят', 0, { initial: true }),
      fact('f4', 'yiannis', 'учился в Афинах', 12, { known_by: ['eleni', 'ghost'] }),
      fact('f5', 'yiannis', 'поймал 5 кг сардин', 25, { goal: true }),
      fact('f6', 'yiannis', 'сардины по 6 евро', 25, { goal: true }),
      fact('f6', 'yiannis', 'дубль', 5),
      fact('f7', 'ghost', 'призрак', 5),
    ],
  }
}

function fact(id: string, about: string, text_ru: string, points: number, extra: Partial<Fact> = {}): Fact {
  return { id, about, text_ru, text_en: text_ru, points, initial: false, goal: false, known_by: [], ...extra }
}

async function start(overrides: Partial<CityDeps> = {}) {
  const db = openDb(':memory:')
  const opened: string[] = []
  const translated: string[] = []
  const deps: CityDeps = {
    allowedUsers: ['Vadim'],
    dailyTalks: 10,
    scenarios: { generate: async () => validateScenario(scenario()) },
    facts: { match: async (_speaker, _lines, facts) => facts.filter((f) => f.id === 'f5').map((f) => f.id) },
    scenes: null,
    translator: { toRussian: async (text) => { translated.push(text); return `ru:${text}` }, toGreek: async (text) => `el:${text}` },
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
  return { call, login, opened, translated, close: () => new Promise((r) => server.close(r)) }
}

test('city is visible only to allowed users', async () => {
  const { call, login, close } = await start()
  assert.deepEqual((await call('GET', '/api/city')).body, { allowed: false, city: 'Μυθόπολη', total: 0, storyMs: 40000 })
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
  assert.deepEqual(first.body.character, { id: 'eleni', name: 'Ελένη', nameRu: 'Элени', role: 'племянница рыбака', roleRu: 'племянница рыбака', place: 'πλατεία', placeRu: 'площадь' })
  assert.deepEqual(first.body.session, { provider: 'fake', connection: { token: 't' } })
  assert.deepEqual(first.body.game.known, ['eleni'])
  assert.equal((await talk('kostas', 'eleni')).status, 409)
  await call('POST', `/api/city/games/${game.id}/introduce`, { characterId: 'eleni', target: 'kostas' }, me)
  assert.equal((await talk('kostas', 'eleni')).status, 200)
  assert.match(opened[1], /just come to you after talking to Ελένη/)

  assert.equal((await call('POST', `/api/city/games/${game.id}/complete`, { characterId: 'kostas' }, me)).status, 409)
  assert.equal((await talk('yiannis', 'kostas')).status, 409)
  await call('POST', `/api/city/games/${game.id}/introduce`, { characterId: 'kostas', target: 'yiannis' }, me)
  assert.equal((await talk('yiannis', 'kostas')).status, 200)
  assert.match(opened[2], /call the tool goal_completed/)
  assert.equal((await call('POST', `/api/city/games/${game.id}/lines`, { characterId: 'yiannis', lines: [{ role: 'user', text: 'Γεια' }] }, me)).status, 200)
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
  const p = buildPersona(validateScenario(scenario()), 'kostas', 'A1', { met: ['eleni'], cameFrom: 'eleni', mood: 'friendly', previous: [] })
  assert.match(p.systemPrompt, /Speak ONLY Greek/)
  assert.match(p.systemPrompt, /CEFR A1/)
  assert.match(p.systemPrompt, /id "yiannis": Γιάννης/)
  assert.match(p.systemPrompt, /Never call the tool goal_completed/)
  assert.match(p.systemPrompt, /cannot leave\. Never offer to go somewhere together/)
  assert.equal(p.language, 'el')
  assert.ok(p.keywords.includes('Μυθόπολη'))
})

test('elevenlabs session carries token, persona overrides and the matching voice', async () => {
  const voices = parseVoices('male-old=v1, female=v2, junk, robot=v3')
  assert.deepEqual(voices, { 'male-old': ['v1'], female: ['v2'] })
  let url = ''
  const fakeFetch = (async (u: string) => {
    url = u
    return new Response(JSON.stringify({ token: 'tok' }))
  }) as typeof fetch
  const provider = elevenLabsVoice({ apiKey: 'k', agentId: 'agent_1', voices, speed: 0.9 }, fakeFetch)
  const persona = buildPersona(validateScenario(scenario()), 'eleni', 'A2', { met: [], cameFrom: null, mood: 'friendly', previous: [] })
  const s = await provider.open(persona)
  assert.match(url, /conversation\/token\?agent_id=agent_1$/)
  const conn = s.connection as { conversationToken: string; overrides: { tts: { voiceId?: string; speed: number } } }
  assert.equal(conn.conversationToken, 'tok')
  assert.deepEqual(conn.overrides.tts, { voiceId: 'v2', speed: 0.9 })
  const slow = await provider.open({ ...persona, speed: 0.75 })
  assert.equal((slow.connection as typeof conn).overrides.tts.speed, 0.75)
})

test('voices rotate within a slot and fall back to the nearest age', () => {
  const voices = parseVoices('male-young=a|b, male-middle=c, female-middle=d|e')
  assert.equal(pickVoice(voices, 'male', 'young', 0), 'a')
  assert.equal(pickVoice(voices, 'male', 'young', 3), 'b')
  assert.equal(pickVoice(voices, 'male', 'old', 0), 'c')
  assert.equal(pickVoice(voices, 'female', 'old', 1), 'e')
  assert.equal(pickVoice(voices, 'female', 'young', 2), 'd')
  assert.equal(pickVoice({}, 'female', 'young', 0), undefined)
})

test('notebook: initial facts of the met, points for told facts, goal facts complete the quest', async () => {
  const { call, login, opened, close } = await start()
  const me = await login('Vadim')
  const game = (await call('POST', '/api/city/games', {}, me)).body.game
  assert.deepEqual(game.notebook, [{ id: 'eleni', name: 'Ελένη', nameRu: 'Элени', gender: 'female', met: false, mood: 'friendly', moodReason: '', facts: [{ id: 'f1', text: 'на вид лет двадцать', points: 0, goal: false }], hidden: 1 }])
  assert.equal(game.score, 0)

  const facts = (speaker: string, factIds: string[]) => call('POST', `/api/city/games/${game.id}/facts`, { characterId: speaker, factIds }, me)
  assert.equal((await facts('eleni', ['f2'])).status, 409)
  await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'eleni' }, me)
  assert.match(opened[0], /f4 \(about Γιάννης\): учился в Афинах/)
  assert.match(opened[0], /call the tool reveal_fact/)
  const told = (await facts('eleni', ['f2', 'f4', 'f5', 'f1', 'nope'])).body.game
  assert.equal(told.score, 22)
  assert.equal(told.total, 22)
  assert.deepEqual(told.notebook.map((p: { id: string }) => p.id), ['eleni', 'yiannis'])
  assert.deepEqual(told.notebook[1], { id: 'yiannis', name: 'Γιάννης', nameRu: 'Яннис', gender: 'male', met: false, mood: 'friendly', moodReason: '', facts: [{ id: 'f4', text: 'учился в Афинах', points: 12, goal: false }], hidden: 2 })

  await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'kostas', from: 'eleni' }, me)
  await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'yiannis', from: 'kostas' }, me)
  const afterLines = (await call('POST', `/api/city/games/${game.id}/lines`, { characterId: 'yiannis', lines: [{ role: 'agent', text: 'Πέντε κιλά σαρδέλες.' }] }, me)).body.game
  assert.equal(afterLines.score, 47)
  assert.equal(afterLines.status, 'active')
  const won = (await facts('yiannis', ['f6'])).body.game
  assert.equal(won.status, 'won')
  assert.equal(won.score, 72)
  assert.deepEqual((await call('GET', '/api/city', undefined, me)).body.total, 72)
  await close()
})

test('scenario validation cleans facts', () => {
  const s = validateScenario(scenario())
  assert.deepEqual(s.facts.map((f) => f.id), ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'])
  assert.deepEqual(s.facts.find((f) => f.id === 'f4')!.known_by, ['yiannis', 'eleni'])
})

test('people appear in the notebook only when introduced; moods persist and shape the next meeting', async () => {
  const { call, login, opened, close } = await start({ facts: null })
  const me = await login('Vadim')
  const game = (await call('POST', '/api/city/games', {}, me)).body.game
  await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'eleni' }, me)
  const said = (await call('POST', `/api/city/games/${game.id}/lines`, { characterId: 'eleni', lines: [
    { role: 'user', text: 'Πού είναι ο Γιάννης;' },
    { role: 'agent', text: 'Ρώτα τον κύριο Κώστα στο καφενείο.' },
  ] }, me)).body.game
  assert.deepEqual(said.notebook.map((p: { id: string }) => p.id), ['eleni'])
  assert.equal((await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'kostas' }, me)).status, 409)
  const stranger = (await call('POST', `/api/city/games/${game.id}/introduce`, { characterId: 'eleni', target: 'yiannis' }, me)).body.game
  assert.deepEqual(stranger.notebook.map((p: { id: string }) => p.id), ['eleni'])
  const heard = (await call('POST', `/api/city/games/${game.id}/introduce`, { characterId: 'eleni', target: 'kostas' }, me)).body.game
  assert.deepEqual(heard.notebook.map((p: { id: string }) => p.id), ['eleni', 'kostas'])

  assert.equal((await call('POST', `/api/city/games/${game.id}/mood`, { characterId: 'eleni', mood: 'furious' }, me)).status, 400)
  const angry = (await call('POST', `/api/city/games/${game.id}/mood`, { characterId: 'eleni', mood: 'offended', reason: 'ты назвал её старой' }, me)).body.game
  assert.equal(angry.notebook[0].mood, 'offended')
  assert.equal(angry.notebook[0].moodReason, 'ты назвал её старой')
  const again = await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'eleni' }, me)
  assert.equal(again.status, 200)
  assert.match(opened[1], /mood towards the tourist right now: offended/)
  assert.match(opened[1], /already talked to this tourist earlier/)
  assert.match(opened[1], /Tourist: Πού είναι ο Γιάννης;/)
  await close()
})

test('translation is cached and only for allowed users', async () => {
  const { call, login, translated, close } = await start()
  assert.equal((await call('POST', '/api/city/translate', { text: 'Γεια' }, await login('Guest'))).status, 403)
  const me = await login('Vadim')
  assert.deepEqual((await call('POST', '/api/city/translate', { text: ' Γεια σου ' }, me)).body, { ru: 'ru:Γεια σου' })
  await call('POST', '/api/city/translate', { text: 'Γεια σου' }, me)
  assert.deepEqual(translated, ['Γεια σου'])
  assert.equal((await call('POST', '/api/city/translate', { text: '' }, me)).status, 400)
  await close()
})

test('scene images are generated in the background, served to the owner and listed on the cards', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { SceneStore } = await import('./images.ts')
  const prompts: string[] = []
  const scenes = new SceneStore(mkdtempSync(`${tmpdir()}/scenes-`), { id: 'fake', generate: async (p) => { prompts.push(p); return Buffer.from('png') } })
  const { call, login, close } = await start({ scenes })
  const me = await login('Vadim')
  const game = (await call('POST', '/api/city/games', {}, me)).body.game
  assert.equal(game.scenesEnabled, true)
  await new Promise((r) => setTimeout(r, 50))
  assert.equal(prompts.length, 3)
  assert.match(prompts[0], /Ελένη/)
  const again = (await call('GET', '/api/city/games/current', undefined, me)).body.game
  assert.equal(again.characters[0].scene, `/api/city/games/${game.id}/scenes/eleni`)
  assert.equal((await call('GET', `/api/city/games/${game.id}/scenes/nobody`, undefined, me)).status, 404)
  const asked = (await call('POST', `/api/city/games/${game.id}/scene`, { characterId: 'kostas' }, me)).body.game
  assert.equal(asked.characters.find((c: { id: string }) => c.id === 'kostas').sceneState.state, 'ready')
  await close()
})

test('google image provider decodes inline image data and reports quota errors', async () => {
  const { googleImages, imageType } = await import('./images.ts')
  let sent = ''
  const ok = googleImages('k', 'gemini-2.5-flash-image', (async (_u: string, init: RequestInit) => {
    sent = String(init.body)
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'x' }, { inlineData: { data: Buffer.from([0xff, 0xd8, 1]).toString('base64') } }] } }] }))
  }) as typeof fetch)
  const img = await ok.generate('boat')
  assert.equal(imageType(img), 'image/jpeg')
  assert.match(sent, /"responseModalities":\["IMAGE"\]/)
  const quota = googleImages('k', 'm', (async () => new Response('{"error":{"code":429}}', { status: 429 })) as typeof fetch)
  await assert.rejects(quota.generate('boat'), /HTTP 429/)
})

test('openai image provider asks for a landscape image and decodes b64', async () => {
  const { openAiImages } = await import('./images.ts')
  let sent = ''
  const p = openAiImages('k', 'gpt-image-1', (async (_u: string, init: RequestInit) => {
    sent = String(init.body)
    return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('img').toString('base64') }] }))
  }) as typeof fetch)
  assert.equal((await p.generate('boat')).toString(), 'img')
  assert.match(sent, /"size":"1536x1024"/)
})

test('old games without Greek goal get it filled in once on load', async () => {
  const old = scenario()
  const { call, login, close } = await start({ scenarios: { generate: async () => validateScenario(old) } })
  const me = await login('Vadim')
  await call('POST', '/api/city/games', {}, me)
  const game = (await call('GET', '/api/city/games/current', undefined, me)).body.game
  assert.equal(game.goal, 'el:Узнай у рыбака, что он поймал')
  assert.equal(game.goalRu, 'Узнай у рыбака, что он поймал')
  assert.equal(game.characters[0].role, 'el:племянница рыбака')
  await close()
})

test('leaderboard ranks players per category, hides other names, keeps you visible', () => {
  const s = validateScenario(scenario())
  const g = (userId: number, found: string[], won: boolean): Game => ({
    id: `g${userId}${found.join('')}`, userId, level: 'A2', scenario: s, met: [], found, heard: [], moods: {}, reasons: {}, status: won ? 'won' : 'active',
  })
  const games = [g(1, ['f2'], false), g(2, ['f5', 'f6'], true), g(3, ['f2', 'f4'], true), g(3, [], true)]
  const boards = leaderboard(games, 1, (id) => `user${id}`)
  const points = boards.find((b) => b.category === 'points')!
  assert.deepEqual(points.rows, [
    { rank: 1, value: 50, you: false, name: null },
    { rank: 2, value: 22, you: false, name: null },
    { rank: 3, value: 10, you: true, name: 'user1' },
  ])
  assert.deepEqual(boards.find((b) => b.category === 'quests')!.rows.map((r) => [r.rank, r.value, r.you]), [[1, 2, false], [2, 1, false], [3, 0, true]])
  const lonely = leaderboard([], 7, () => 'me')
  assert.deepEqual(lonely[0].rows, [{ rank: 1, value: 0, you: true, name: 'me' }])
})

test('audio tags are stripped from lines; level check is returned and its notes reach the next persona', async () => {
  const { call, login, opened, close } = await start({
    facts: null,
    levels: { check: async (_level, lines) => (lines.length > 1 ? [{ index: 1, reason_ru: 'перфект «έχεις κάψει»', note_en: 'Do not use the perfect tense.' }] : []) },
  })
  const me = await login('Vadim')
  const game = (await call('POST', '/api/city/games', { level: 'A1' }, me)).body.game
  await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'eleni' }, me)
  const res = (await call('POST', `/api/city/games/${game.id}/lines`, { characterId: 'eleni', lines: [
    { role: 'agent', text: '[happy] Γεια σου!' },
    { role: 'agent', text: 'Έχεις κάψει πολύ! [concerned]' },
  ] }, me)).body
  assert.deepEqual(res.check, { level: 'A1', total: 2, issues: [{ text: 'Έχεις κάψει πολύ!', reason: 'перфект «έχεις κάψει»' }] })
  await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'eleni' }, me)
  assert.match(opened[1], /too difficult[\s\S]*Do not use the perfect tense/)
  assert.match(opened[1], /Γεια σου!/)
  assert.doesNotMatch(opened[1], /\[happy\]/)
  assert.match(opened[1], /never «εσείς»/)
  await close()
})

test('stripTags and moderated voices', async () => {
  assert.equal(stripTags('[excited] [laugh] Καλώς ήρθατε! [slow]'), 'Καλώς ήρθατε!')
  const cfg = { apiKey: 'k', agentId: 'a', speed: 1, voices: parseVoices('female-young=bad|good,male=bad') }
  const fake = (async (u: string) => new Response(JSON.stringify({ sharing: { live_moderation_enabled: u.endsWith('/bad') } }))) as typeof fetch
  assert.deepEqual(await dropModeratedVoices(cfg, fake), ['bad', 'bad'])
  assert.deepEqual(cfg.voices, { 'female-young': ['good'] })
})

test('ambience: guessed from the place for old scenarios, generated once, served and linked from cards', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { AmbienceStore, ambienceOf } = await import('./ambience.ts')
  const s = validateScenario(scenario())
  assert.equal(ambienceOf(s.characters[2]), 'harbour')
  assert.equal(ambienceOf(s.characters[1]), 'kafeneio')
  assert.equal(ambienceOf({ ...s.characters[0], ambience: 'bakery' }), 'bakery')
  const made: string[] = []
  const ambience = new AmbienceStore(mkdtempSync(`${tmpdir()}/amb-`), { generate: async (p) => { made.push(p); return Buffer.from('mp3') } })
  const { call, login, close } = await start({ ambience })
  const me = await login('Vadim')
  await call('POST', '/api/city/games', {}, me)
  await new Promise((r) => setTimeout(r, 50))
  assert.equal(made.length, 3)
  const game = (await call('GET', '/api/city/games/current', undefined, me)).body.game
  assert.equal(game.characters.find((c: { id: string }) => c.id === 'yiannis').ambience, '/api/city/ambience/harbour')
  assert.equal(made.length, 3)
  assert.equal((await call('GET', '/api/city/ambience/../../etc', undefined, me)).status, 404)
  await close()
})

test('scene failures are reported and pause generation on billing errors', async () => {
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { SceneStore } = await import('./images.ts')
  const { ProviderError } = await import('./providers.ts')
  const s = validateScenario(scenario())
  let calls = 0
  const flaky = new SceneStore(mkdtempSync(`${tmpdir()}/sc-`), { id: 'x', generate: async () => { calls++; throw new Error('boom') } })
  await flaky.ensure('g', s.characters[0])
  assert.deepEqual(flaky.status('g', 'eleni'), { state: 'failed' })
  await flaky.ensure('g', s.characters[0])
  assert.equal(calls, 1)
  assert.equal(flaky.enabled, true)
  const broke = new SceneStore(mkdtempSync(`${tmpdir()}/sc-`), { id: 'x', generate: async () => { throw new ProviderError('openai image: HTTP 400 Billing hard limit has been reached') } })
  await broke.ensure('g', s.characters[0])
  assert.equal(broke.enabled, false)
  assert.deepEqual(broke.status('g', 'kostas'), { state: 'failed' })
})

test('residents remember only their own talk within one story, nobody remembers the tourist across stories', async () => {
  const { call, login, opened, close } = await start({ facts: null })
  const me = await login('Vadim')
  const game = (await call('POST', '/api/city/games', {}, me)).body.game
  await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'eleni' }, me)
  await call('POST', `/api/city/games/${game.id}/lines`, { characterId: 'eleni', lines: [{ role: 'user', text: 'Με λένε Βαδίμ' }] }, me)
  await call('POST', `/api/city/games/${game.id}/introduce`, { characterId: 'eleni', target: 'kostas' }, me)
  await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'kostas', from: 'eleni' }, me)
  assert.doesNotMatch(opened[1], /Βαδίμ/)
  await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'eleni' }, me)
  assert.match(opened[2], /Tourist: Με λένε Βαδίμ/)
  const next = (await call('POST', '/api/city/games', {}, me)).body.game
  await call('POST', `/api/city/games/${next.id}/talk`, { characterId: 'eleni' }, me)
  assert.doesNotMatch(opened[3], /Βαδίμ/)
  assert.doesNotMatch(opened[3], /already talked to this tourist/)
  await close()
})

test('story editor: a rejected draft is redrafted with the problems, at most a few rounds', async () => {
  const { draftAndReview } = await import('./claude.ts')
  const { scenarioRequest } = await import('./scenario.ts')
  const seen: string[][] = []
  const drafts = [scenario(), scenario(), scenario()]
  drafts[0].goal_ru = 'Отправь открытку в Мифополи'
  let n = 0
  const result = await draftAndReview(
    async (problems) => { seen.push(problems); return drafts[n++] },
    async (s) => (s.goal_ru.includes('открытку') ? { ok: false, problems: ['The player is already in Μυθόπολη'] } : { ok: true, problems: [] }),
    3,
  )
  assert.equal(result, drafts[1])
  assert.deepEqual(seen, [[], ['The player is already in Μυθόπολη']])
  let rounds = 0
  await draftAndReview(async () => { rounds++; return scenario() }, async () => ({ ok: false, problems: ['x'] }), 3)
  assert.equal(rounds, 3)
  assert.match(scenarioRequest('A2', [], ['The player is already in Μυθόπολη']), /rejected by the editor[\s\S]*already in Μυθόπολη/)
  assert.match(scenarioRequest('A2', []), /Postcards and letters go to the player's home country/)
})

test('time of day: from the player hour into the story, residents and scene lighting', async () => {
  const { timeOfDay, scenarioRequest } = await import('./scenario.ts')
  const { scenePrompt } = await import('./images.ts')
  assert.deepEqual([5, 6, 11, 12, 16, 17, 20, 21, 0].map(timeOfDay), ['night', 'morning', 'morning', 'noon', 'noon', 'evening', 'evening', 'night', 'night'])
  assert.match(scenarioRequest('A2', [], [], 'night'), /It is night[\s\S]*happens right now/)
  assert.doesNotMatch(scenarioRequest('A2', []), /It is (morning|night)/)
  const s = validateScenario(scenario())
  assert.match(scenePrompt(s.characters[0], 'evening'), /sunset/)
  assert.doesNotMatch(scenePrompt(s.characters[0]), /sunset|moon/)
  let asked: string | undefined
  const { call, login, opened, close } = await start({ scenarios: { generate: async (_l, _r, time) => { asked = time; const sc = validateScenario(scenario()); sc.time_of_day = time; return sc } } })
  const me = await login('Vadim')
  const game = (await call('POST', '/api/city/games', { hour: 22 }, me)).body.game
  assert.equal(asked, 'night')
  await call('POST', `/api/city/games/${game.id}/talk`, { characterId: 'eleni' }, me)
  assert.match(opened[0], /Time of day: night/)
  await close()
})
